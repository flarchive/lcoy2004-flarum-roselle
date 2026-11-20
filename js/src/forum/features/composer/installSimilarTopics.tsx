/*
 * “你的主题与以下内容相似……”——用户撰写新主题标题时，Discourse
 * 会查找相似主题并显示在 composer 旁的气泡中，以避免提出重复问题。
 *
 * 搜索在输入三个及以上单词时开始，并等待用户停止输入。气泡在用户
 * 关闭后消失（直到标题确实再次改变），或在没有结果时消失。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import { debounce } from 'flarum/common/utils/throttleDebounce';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { composerOn } from './common';
import { discussionBadges } from '../../utils/tags';
import { shortAge, fullDate } from '../../utils/dates';
import { t } from '../../utils/settings';

const MIN_WORDS = 3;
const LIMIT = 5;
const WAIT_MS = 700;

interface SimilarState {
  title: string;
  /** 上次搜索的标题——仅当它真正改变时才重新搜索。 */
  searched: string;
  results: Discussion[];
  dismissedFor: string | null;
  search: (title: string) => void;
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function installSimilarTopics() {
  extend('flarum/forum/components/DiscussionComposer', 'oninit', function (this: any) {
    let request = 0;

    const state: SimilarState = {
      title: '',
      searched: '',
      results: [],
      dismissedFor: null,
      search: debounce(WAIT_MS, (title: string) => {
        const current = ++request;

        app.store
          .find<Discussion[]>('discussions', { filter: { q: title }, page: { limit: LIMIT } } as any, undefined, { errorHandler: () => {} } as any)
          .then((results) => {
            // 已发起更新的搜索：此响应属于迟到。
            if (current !== request) return;

            state.results = Array.from(results);
            m.redraw();
          })
          .catch(() => {});
      }),
    };

    this.lcoySimilar = state;
  });

  extend('flarum/forum/components/DiscussionComposer', 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    const state: SimilarState | undefined = this.lcoySimilar;

    if (!state || !composerOn('Similar')) return;

    // headerItems 在每次重绘时运行，标题中的每次按键都会触发重绘：
    // 标题的变化正是在此被感知。
    const title = normalizeTitle(this.title?.() || '');

    if (title !== state.title) {
      state.title = title;

      if (title.split(' ').filter(Boolean).length >= MIN_WORDS) {
        if (title !== state.searched) {
          state.searched = title;
          state.search(title);
        }
      } else {
        state.results = [];
        state.searched = '';
      }
    }

    const minimized = app.composer.position === 'minimized';

    if (minimized || !state.results.length || state.dismissedFor === state.searched) return;

    items.add(
      'lcoySimilar',
      <div className="LcoySimilarTopics" role="region" aria-label={t('composer.similar.title')}>
        <div className="LcoySimilarTopics-header">
          <h4 className="LcoySimilarTopics-title">{t('composer.similar.title')}</h4>
          <button
            type="button"
            className="Button Button--icon Button--link LcoySimilarTopics-close"
            aria-label={t('composer.similar.close')}
            title={t('composer.similar.close')}
            onclick={() => (state.dismissedFor = state.searched)}
          >
            <Icon name="fas fa-xmark" />
          </button>
        </div>
        <ul className="LcoySimilarTopics-list">
          {state.results.map((discussion) => (
            <li key={discussion.id()}>
              <Link
                className="LcoySimilarTopics-item"
                href={app.route.discussion(discussion)}
                // 切换页面时 composer 保持打开（它属于 app，而非
                // 页面）；最小化后，用户阅读主题再返回其中。
                onclick={() => app.composer.minimize()}
              >
                <span className="LcoySimilarTopics-itemTitle">{discussion.title()}</span>
                <span className="LcoySimilarTopics-itemMeta">
                  {discussionBadges(discussion, false)}
                  <span className="LcoySimilarTopics-itemStats" title={fullDate(discussion.lastPostedAt() || discussion.createdAt())}>
                    <Icon name="far fa-comment" /> {discussion.replyCount()} · {shortAge(discussion.lastPostedAt() || discussion.createdAt())}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>,
      -100
    );
  });
}
