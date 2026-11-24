/*
 * 主题末尾的 Discourse more-topics：在标题位置放“推荐”和“✨ 相关”两个标签页，
 * 用紧凑表格展示回复数、浏览量和活跃时间。只有一份列表时，它直接带标题。
 *
 * - 推荐：同分类（没有标签时则是整个论坛）的最新主题。
 * - 相关：开启 AI 功能（embeddings）时，使用该功能给出的语义相关主题；
 *   否则是与本主题共享某个标签的主题，评论最多的排前面。一个都没有时该标签页隐藏。
 *
 * 类名是独立的（.LcoySuggested*）：主列表另有归属，变化节奏也不同，
 * 两者不应一起坏掉。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { discussionBadges, isTagsEnabled, splitDiscussionTags } from '../../utils/tags';
import { fullDate, shortAge } from '../../utils/dates';
import { forumBool, forumInt, t } from '../../utils/settings';
import { viewsHeat, viewsNumber } from '../../utils/views';
import { discussionViews } from '../../list/metrics';

/** 表格中的一行，可能来自 store 的模型，也可能来自 AI API。 */
interface Row {
  id: string;
  title: string;
  href: string;
  replies: number;
  views: number | null;
  last: Date | null;
  unread: number;
  badges: Mithril.Children;
}

interface Lists {
  suggested: Row[];
  related: Row[];
}

type Tab = keyof Lists;

/**
 * 已按主题缓存的列表：末尾这一行会随 stream 加载帖子而出现和消失，
 * 否则每次都会发一次新请求。
 */
const cache = new Map<string, Lists>();

export interface SuggestedTopicsAttrs extends ComponentAttrs {
  discussion: Discussion;
}

function include(): string {
  return isTagsEnabled() ? 'tags,user,lastPostedUser' : 'user,lastPostedUser';
}

function fromDiscussion(topic: Discussion): Row {
  const unread = !!app.session.user && topic.isUnread() ? topic.unreadCount() : 0;

  return {
    id: topic.id()!,
    title: topic.title(),
    href: app.route.discussion(topic, unread ? (topic.lastReadPostNumber() || 0) + 1 : undefined),
    replies: topic.replyCount(),
    // 与列表中是同一个数字：主题自己计数时用它自己的值，或扩展启用后
    // fof/discussion-views 发布的 `views`。
    views: discussionViews(topic),
    last: topic.lastPostedAt() || topic.createdAt() || null,
    unread,
    badges: discussionBadges(topic),
  };
}

export default class SuggestedTopics extends Component<SuggestedTopicsAttrs> {
  loading = false;
  tab: Tab = 'suggested';

  oninit(vnode: Mithril.Vnode<SuggestedTopicsAttrs, this>) {
    super.oninit(vnode);

    if (!cache.has(this.attrs.discussion.id()!)) this.load();
  }

  load() {
    const discussion = this.attrs.discussion;
    const id = discussion.id()!;
    const limit = forumInt('lcoySuggestedCount', 5);

    this.loading = true;

    Promise.all([this.loadSuggested(discussion, limit), this.loadRelated(discussion, limit)])
      .then(([suggested, related]) => {
        const seen = new Set(suggested.map((row) => row.id));

        cache.set(id, { suggested, related: related.filter((row) => !seen.has(row.id)) });
      })
      .catch(() => cache.set(id, { suggested: [], related: [] }))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  loadSuggested(discussion: Discussion, limit: number): Promise<Row[]> {
    const { categories } = splitDiscussionTags(discussion);
    // 最具体的一个：主题位于子分类时取子分类。
    const category = categories[categories.length - 1];

    const params: Record<string, unknown> = { sort: '-lastPostedAt', page: { limit: limit + 1 }, include: include() };

    if (category) params.filter = { tag: category.slug() };

    return app.store
      .find<Discussion[]>('discussions', params, undefined, { errorHandler: () => {} })
      .then((results) =>
        Array.from(results)
          .filter((item) => item && item.id() !== discussion.id())
          .slice(0, limit)
          .map(fromDiscussion)
      )
      .catch(() => []);
  }

  loadRelated(discussion: Discussion, limit: number): Promise<Row[]> {
    // 与它共享某个标签的主题（tags 过滤按“或”合并）。
    const { labels } = splitDiscussionTags(discussion);

    if (!labels.length) return Promise.resolve([]);

    return app.store
      .find<Discussion[]>(
        'discussions',
        { sort: '-commentCount', filter: { tag: labels.map((tag) => tag.slug()).join(',') }, page: { limit: limit * 2 }, include: include() },
        undefined,
        { errorHandler: () => {} }
      )
      .then((results) =>
        Array.from(results)
          .filter((item) => item && item.id() !== discussion.id())
          .slice(0, limit)
          .map(fromDiscussion)
      )
      .catch(() => []);
  }

  view() {
    if (this.loading) {
      return (
        <section className="LcoySuggested">
          <LoadingIndicator display="block" />
        </section>
      );
    }

    const lists = cache.get(this.attrs.discussion.id()!) || { suggested: [], related: [] };
    const tabs = (['suggested', 'related'] as Tab[]).filter((tab) => lists[tab].length);

    if (!tabs.length) return null;

    const tab = tabs.indexOf(this.tab) !== -1 ? this.tab : tabs[0];
    const rows = lists[tab];
    const views = rows.some((row) => row.views !== null);
    const single = tabs.length === 1;

    return (
      <section className="LcoySuggested" aria-labelledby="lcoy-suggested-title">
        {single && (
          <h2 className="LcoySuggested-title" id="lcoy-suggested-title">
            {tab === 'related' && <Icon name="fas fa-wand-magic-sparkles" />} {t(`topic.suggested.${tab === 'related' ? 'related_title' : 'title'}`)}
          </h2>
        )}
        <table className="LcoySuggested-table">
          <thead>
            <tr>
              <th scope="col" className="LcoySuggested-topicHead">
                {single ? (
                  t('topic.suggested.topic')
                ) : (
                  <ul className="LcoySuggested-tabs" role="tablist" id="lcoy-suggested-title">
                    {tabs.map((key) => (
                      <li>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={key === tab ? 'true' : 'false'}
                          className={classList('LcoySuggested-tab', { active: key === tab })}
                          onclick={() => (this.tab = key)}
                        >
                          {key === 'related' && <Icon name="fas fa-wand-magic-sparkles" />}
                          {t(`topic.suggested.tab_${key}`)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </th>
              <th scope="col" className="LcoySuggested-num">
                {t('topic.suggested.replies')}
              </th>
              {views && (
                <th scope="col" className="LcoySuggested-num">
                  {t('topic.suggested.views')}
                </th>
              )}
              <th scope="col" className="LcoySuggested-num">
                {t('topic.suggested.activity')}
              </th>
            </tr>
          </thead>
          <tbody>{rows.map((row) => this.row(row, views))}</tbody>
        </table>
      </section>
    );
  }

  row(row: Row, views: boolean) {
    return (
      <tr className={classList('LcoySuggested-row', { 'LcoySuggested-row--unread': row.unread > 0 })}>
        <td className="LcoySuggested-topic">
          <Link className="LcoySuggested-link" href={row.href}>
            {row.title}
          </Link>
          {row.unread > 0 && <span className="LcoySuggested-unread">{abbreviateNumber(row.unread)}</span>}
          <div className="LcoySuggested-badges">{row.badges}</div>
        </td>
        <td className="LcoySuggested-num LcoySuggested-replies">{abbreviateNumber(row.replies)}</td>
        {views && this.viewsCell(row.views || 0)}
        <td className="LcoySuggested-num LcoySuggested-activity" title={row.last ? fullDate(row.last) : ''}>
          {row.last ? shortAge(row.last) : ''}
        </td>
      </tr>
    );
  }

  /** 与列表中的该列一致：Discourse 的数字、完整写法的 title 以及热度（`heatmap-*`）。 */
  viewsCell(count: number) {
    const heat = forumBool('lcoyListHeat', true) ? viewsHeat(count) : null;

    return <td className={classList('LcoySuggested-num LcoySuggested-views', heat && `heatmap-${heat}`)}>{viewsNumber(count)}</td>;
  }
}
