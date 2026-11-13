/*
 * 基于 flarum/flags 的 Discourse 审核队列（/review）：每个有未处理
 * 举报的帖子变成一个 `.reviewable-item` —— 类型、带
 * 分类的主题、完整帖子、举报人与原因，以及操作。
 *
 * flarum/flags 不保存历史（解决 = 删除举报），因此
 * 没有 Discourse 的状态过滤器；过滤依据是条目类型。
 * flarum/approval 扣下的帖子通过同一列表到达（它创建
 * 一个 `approval` 类型的举报），并显示为 "队列中的帖子"。
 *
 * 列表在这里加载，而不是由 `app.flags` 加载，因为条目需要
 * 带全部举报和主题标签的完整帖子：
 * `FlagListState` 只请求帖子和作者。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import username from 'flarum/common/helpers/username';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { discussionBadges, isTagsEnabled } from '../utils/tags';
import { fullDate, shortAge } from '../utils/dates';
import { isExtensionEnabled, t } from '../utils/settings';

/** 条目显示的全部内容，一次请求完成。 */
const INCLUDE = ['user', 'post', 'post.user', 'post.discussion', 'post.discussion.tags', 'post.flags', 'post.flags.user'];

/** 超过此长度时帖子初始折叠，与 Discourse 的 `.post-body.is-collapsed` 相同。 */
const COLLAPSE_AT = 600;

type ReviewFilter = 'all' | 'flagged' | 'queued';

/** flarum/flags 的原因，使用 Discourse 的举报名称。 */
const REASONS: Record<string, string> = {
  off_topic: 'review.reason_off_topic',
  inappropriate: 'review.reason_inappropriate',
  spam: 'review.reason_spam',
  other: 'review.reason_other',
};

function rt(key: string, params: Record<string, unknown> = {}): string {
  return t(`review.${key}`, params);
}

function postFlags(post: Post): any[] {
  return ((post as any).flags?.() || []).filter(Boolean);
}

/** 在 flarum/approval 的队列中：它的举报，或尚未批准的帖子。 */
function isQueued(post: Post): boolean {
  return (post as any).isApproved?.() === false || postFlags(post).some((flag) => flag.type() === 'approval');
}

function reasonLabel(flag: any): string {
  const reason = flag.reason?.() || '';

  if (REASONS[reason]) return t(REASONS[reason]);
  if (reason) return extractText(app.translator.trans(`flarum-flags.forum.flag_post.reason_${reason}_label`));

  return t('review.reason_other');
}

function reasonIcon(flag: any): string {
  switch (flag.reason?.()) {
    case 'off_topic':
      return 'fas fa-comment-slash';
    case 'spam':
      return 'fas fa-ban';
    case 'inappropriate':
      return 'fas fa-triangle-exclamation';
    default:
      return 'fas fa-flag';
  }
}

export default class ReviewQueue extends Component {
  /** 每个帖子一条举报（API 按帖子分组）；帖子包含全部举报。 */
  posts: Post[] = [];
  loading = true;
  loadingMore = false;
  hasMore = false;
  offset = 0;
  filter: ReviewFilter = 'all';
  busy = new Set<string>();
  expanded = new Set<string>();

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const param = String(m.route.param('type') || '');
    if (param === 'flagged' || param === 'queued') this.filter = param as ReviewFilter;

    this.load();
  }

  /** 帖子进入队列的时间：最新的举报，或帖子本身（在审核批准中）。 */
  postDate(post: Post): number {
    if (isQueued(post)) return post.createdAt()?.getTime() || 0;

    return Math.max(
      0,
      ...postFlags(post)
        .filter((flag) => flag.type() !== 'approval')
        .map((flag) => flag.createdAt()?.getTime() || 0)
    );
  }

  /** 队列中的帖子，从最新到最旧。 */
  entries(): Mithril.Children[] {
    const items: { date: number; render: () => Mithril.Children }[] = [];

    if (this.filter !== 'queued') {
      this.visiblePosts().forEach((post) => items.push({ date: this.postDate(post), render: () => this.item(post) }));
    }

    return items.sort((a, b) => b.date - a.date).map((entry) => entry.render());
  }

  load(more = false): void {
    // 仅管理聊天的人看不到帖子举报（API 会拒绝）。
    if (!app.forum.attribute<boolean>('canViewFlags')) {
      this.loading = false;
      return;
    }

    if (more) this.loadingMore = true;

    app.store
      .find<any[]>('flags', { include: INCLUDE.join(','), page: { offset: this.offset } } as any)
      .then((results: any) => {
        const seen = new Set(this.posts.map((post) => post.id()));

        Array.from(results as any[]).forEach((flag: any) => {
          const post = flag.post?.() as Post | false;

          if (post && !seen.has(post.id())) {
            seen.add(post.id());
            this.posts.push(post);
          }
        });

        this.offset += Array.from(results as any[]).length;
        this.hasMore = !!results.payload?.links?.next;

        // API 已将全部标记为已读（`read_flags_at`）：菜单气泡归零。
        app.session.user?.pushAttributes({ newFlagCount: 0 });
      })
      .catch(() => {})
      .then(() => {
        this.loading = false;
        this.loadingMore = false;
        m.redraw();
      });
  }

  visiblePosts(): Post[] {
    if (this.filter === 'all') return this.posts;

    return this.posts.filter((post) => (this.filter === 'queued' ? isQueued(post) : !isQueued(post)));
  }

  view() {
    const entries = this.entries();

    return (
      <div className="LcoyReview reviewable">
        <div className="LcoyReview-header">
          <h2 className="LcoyReview-title">{rt('title')}</h2>
          {this.filters()}
        </div>
        {this.loading ? (
          <LoadingIndicator />
        ) : entries.length ? (
          <div className="reviewables">{entries}</div>
        ) : (
          <div className="LcoyReview-empty no-review">{rt('empty')}</div>
        )}
        {this.hasMore && !this.loading ? (
          <div className="LcoyReview-more">
            <Button className="Button" loading={this.loadingMore} onclick={() => this.load(true)}>
              {rt('load_more')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  filters(): Mithril.Children {
    const options: { key: ReviewFilter; label: string }[] = [
      { key: 'all', label: rt('filter_all') },
      { key: 'flagged', label: rt('filter_flagged') },
    ];

    if (isExtensionEnabled('flarum-approval')) options.push({ key: 'queued', label: rt('filter_queued') });

    return (
      <ul className="LcoyReview-filters reviewable-filters" role="tablist" aria-label={rt('filter_label')}>
        {options.map((option) => (
          <li key={option.key} className={classList('LcoyReview-filter', { active: this.filter === option.key })}>
            <button
              type="button"
              role="tab"
              aria-selected={this.filter === option.key ? 'true' : 'false'}
              onclick={() => {
                this.filter = option.key;
              }}
            >
              {option.label}
              {this.countFor(option.key) ? <span className="LcoyReview-filterCount">{this.countFor(option.key)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  countFor(filter: ReviewFilter): number {
    if (filter === 'all') return this.posts.length;
    if (filter === 'flagged') return this.posts.filter((post) => !isQueued(post)).length;

    return this.posts.filter((post) => (filter === 'queued' ? isQueued(post) : !isQueued(post))).length;
  }

  item(post: Post): Mithril.Children {
    const id = post.id()!;
    const queued = isQueued(post);
    const flags = postFlags(post).filter((flag) => flag.type() !== 'approval');
    const discussion: any = post.discussion();
    const user = post.user() as User | false;
    const created = queued
      ? post.createdAt()
      : flags
          .map((flag) => flag.createdAt())
          .filter(Boolean)
          .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
    const long = (post.contentPlain?.() || '').length > COLLAPSE_AT;
    const collapsed = long && !this.expanded.has(id);

    return (
      <article
        key={id}
        className={classList('reviewable-item', queued ? 'reviewable-queued-post' : 'reviewable-flagged-post', {
          'is-busy': this.busy.has(id),
          'is-hidden': post.isHidden(),
        })}
        data-post-id={id}
      >
        <div className="reviewable-meta-data">
          <span className="reviewable-type">{queued ? rt('type_queued') : rt('type_flagged')}</span>
          {queued ? null : this.reasonChips(flags)}
          <span className="created-at" title={created ? fullDate(created) : undefined}>
            {created ? <Link href={app.route.post(post)}>{shortAge(created)}</Link> : null}
          </span>
          <span className="reviewable-status status pending">{rt('status_pending')}</span>
        </div>

        {discussion ? (
          <div className="post-topic">
            <Link className="title-text" href={app.route.discussion(discussion)}>
              {discussion.title()}
            </Link>
            {isTagsEnabled() ? discussionBadges(discussion) : null}
          </div>
        ) : null}

        <div className="post-contents-wrapper">
          <div className="created-by">
            {user ? (
              <Link href={app.route.user(user)} title={user.displayName()}>
                <Avatar user={user} />
              </Link>
            ) : (
              <Avatar user={null} />
            )}
          </div>
          <div className="post-contents">
            <div className="post-information">
              {user ? (
                <Link className="names username" href={app.route.user(user)}>
                  {username(user)}
                </Link>
              ) : (
                <span className="names username">{username(user)}</span>
              )}
              {post.isHidden() ? (
                <span className="LcoyReview-hiddenLabel">
                  <Icon name="far fa-eye-slash" />
                  {rt('hidden_label')}
                </span>
              ) : null}
              <Link className="LcoyReview-postLink" href={app.route.post(post)}>
                <Icon name="fas fa-up-right-from-square" />
                {rt('view_post')}
              </Link>
            </div>
            <div className={classList('post-body Post-body', { 'is-collapsed': collapsed })}>{m.trust(post.contentHtml() || '')}</div>
            {long ? (
              <Button
                className="Button Button--flat post-body__toggle-btn"
                icon={collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up'}
                onclick={() => (collapsed ? this.expanded.add(id) : this.expanded.delete(id))}
              >
                {collapsed ? rt('show_more') : rt('show_less')}
              </Button>
            ) : null}
          </div>
        </div>

        {queued ? <div className="reviewable-score-reason">{rt('queued_reason')}</div> : this.scores(flags)}

        <div className="reviewable-actions">{queued ? this.queuedActions(post) : this.flaggedActions(post)}</div>
      </article>
    );
  }

  /** "不当 ×2" —— 汇总后的原因，与 `.review-item__flag-badges` 相同。 */
  reasonChips(flags: any[]): Mithril.Children {
    const counts = new Map<string, { flag: any; count: number }>();

    flags.forEach((flag) => {
      const key = flag.reason?.() || 'other';
      const entry = counts.get(key);

      if (entry) entry.count++;
      else counts.set(key, { flag, count: 1 });
    });

    return (
      <span className="LcoyReview-reasons">
        {Array.from(counts.values()).map(({ flag, count }) => (
          <span className="reviewable-score-type">
            <Icon name={reasonIcon(flag)} />
            {reasonLabel(flag)}
            {count > 1 ? <span className="LcoyReview-reasonCount">×{count}</span> : null}
          </span>
        ))}
      </span>
    );
  }

  /** 举报人、原因、时间以及留言（Discourse 的 `.reviewable-scores`）。 */
  scores(flags: any[]): Mithril.Children {
    if (!flags.length) return null;

    return (
      <div className="reviewable-scores">
        <table>
          <thead>
            <tr>
              <th>{rt('flagged_by')}</th>
              <th>{rt('flag_type')}</th>
              <th>{rt('flag_date')}</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => {
              const flagger = flag.user?.() as User | false;
              const detail = flag.reasonDetail?.() || '';

              return [
                <tr className="reviewable-score">
                  <td className="user">
                    {flagger ? (
                      <Link href={app.route.user(flagger)}>
                        <Avatar user={flagger} />
                        <span>{flagger.displayName()}</span>
                      </Link>
                    ) : (
                      <span>{username(flagger)}</span>
                    )}
                  </td>
                  <td className="LcoyReview-reason">
                    <Icon name={reasonIcon(flag)} />
                    {reasonLabel(flag)}
                  </td>
                  <td className="LcoyReview-when" title={flag.createdAt() ? fullDate(flag.createdAt()) : undefined}>
                    {shortAge(flag.createdAt())}
                  </td>
                </tr>,
                detail ? (
                  <tr className="reviewable-score-detail">
                    <td colspan={3}>
                      <blockquote className="reviewable-conversation-post">{detail}</blockquote>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
    );
  }

  flaggedActions(post: Post): Mithril.Children {
    const id = post.id()!;
    const disabled = this.busy.has(id);
    const canHide = !!post.canHide?.();
    const hidden = post.isHidden();
    const agree: Mithril.Children[] = [];

    if (canHide && !hidden) {
      agree.push(
        <Button icon="far fa-eye-slash" onclick={() => this.run(post, () => this.hide(post).then(() => this.dismiss(post)), 'done_agreed_hidden')}>
          {rt('agree_and_hide')}
        </Button>
      );
    }

    agree.push(
      <Button icon="far fa-thumbs-up" onclick={() => this.run(post, () => this.dismiss(post), 'done_agreed')}>
        {hidden ? rt('agree_and_keep_hidden') : rt('agree_and_keep')}
      </Button>
    );

    return [
      <Dropdown
        className="LcoyReview-agree"
        buttonClassName="Button Button--primary"
        label={rt('agree')}
        icon="far fa-thumbs-up"
        accessibleToggleLabel={rt('agree')}
      >
        {agree}
      </Dropdown>,
      <Button
        className="Button"
        icon="far fa-thumbs-down"
        disabled={disabled}
        onclick={() =>
          this.run(post, () => (hidden && canHide ? this.restore(post) : Promise.resolve()).then(() => this.dismiss(post)), 'done_disagreed')
        }
      >
        {hidden && canHide ? rt('disagree_and_restore') : rt('disagree')}
      </Button>,
      <Button
        className="Button"
        icon="fas fa-right-from-bracket"
        disabled={disabled}
        onclick={() => this.run(post, () => this.dismiss(post), 'done_ignored')}
      >
        {rt('ignore')}
      </Button>,
      this.canDelete(post) ? (
        <Button
          className="Button Button--danger"
          icon="far fa-trash-can"
          disabled={disabled}
          onclick={() => this.confirmDelete(post, 'done_deleted')}
        >
          {rt('delete_post')}
        </Button>
      ) : null,
    ];
  }

  queuedActions(post: Post): Mithril.Children {
    const disabled = this.busy.has(post.id()!);

    return [
      (post as any).canApprove?.() ? (
        <Button
          className="Button Button--primary"
          icon="fas fa-check"
          disabled={disabled}
          onclick={() => this.run(post, () => this.approve(post), 'done_approved')}
        >
          {rt('approve_post')}
        </Button>
      ) : null,
      this.canDelete(post) ? (
        <Button
          className="Button Button--danger"
          icon="fas fa-xmark"
          disabled={disabled}
          onclick={() => this.confirmDelete(post, 'done_rejected', rt('reject_confirm'))}
        >
          {rt('reject_post')}
        </Button>
      ) : null,
    ];
  }

  // -------------------------------------------------------------------
  // 操作：与 flarum/flags（DELETE /posts/:id/flags）、核心
  //（隐藏、恢复、删除）以及 flarum/approval（isApproved）相同的调用。
  // -------------------------------------------------------------------

  /** 删除第一个帖子就是删除主题，与 Discourse 相同。 */
  canDelete(post: Post): boolean {
    const discussion: any = post.discussion();

    if (post.number() === 1 && discussion) return !!discussion.canDelete?.();

    return !!post.canDelete?.();
  }

  run(post: Post, action: () => Promise<unknown>, doneKey: string): void {
    const id = post.id()!;

    if (this.busy.has(id)) return;

    this.busy.add(id);

    action()
      .then(() => {
        this.resolved(post);
        app.alerts.show({ type: 'success' }, rt(doneKey));
      })
      .catch(() => {})
      .then(() => {
        this.busy.delete(id);
        m.redraw();
      });
  }

  confirmDelete(post: Post, doneKey: string, question = rt('delete_confirm')): void {
    if (!confirm(question)) return;

    this.run(post, () => this.delete(post), doneKey);
  }

  dismiss(post: Post): Promise<unknown> {
    return app.request({ url: app.forum.attribute('apiUrl') + (post as any).apiEndpoint() + '/flags', method: 'DELETE' }).then(() => {
      // 与 flarum/flags 的 `dismissFlag` 相同：主题中的帖子失去该标记。
      if ((post.data as any).relationships) delete (post.data as any).relationships.flags;
    });
  }

  hide(post: Post): Promise<unknown> {
    post.pushData({ attributes: { hiddenAt: new Date() }, relationships: { hiddenUser: app.session.user } } as any);

    return post.save({ isHidden: true });
  }

  restore(post: Post): Promise<unknown> {
    post.pushData({ attributes: { hiddenAt: null }, relationships: { hiddenUser: null } } as any);

    return post.save({ isHidden: false });
  }

  approve(post: Post): Promise<unknown> {
    return post.save({ isApproved: true } as any).then(() => {
      if (post.number() === 1) (post.discussion() as any)?.pushAttributes({ isApproved: true });

      // `approval` 举报保留：flarum/flags 会一并删除它，
      // 与帖子标记栏中的 "批准" 按钮相同。
      return this.dismiss(post);
    });
  }

  delete(post: Post): Promise<unknown> {
    const discussion: any = post.discussion();

    if (post.number() === 1 && discussion) {
      return discussion.delete().then(() => (app as any).discussions?.removeDiscussion?.(discussion));
    }

    return post.delete().then(() => discussion?.removePost?.(post.id()));
  }

  /** 移出队列；菜单计数和 `app.flags` 的列表会一同更新。 */
  resolved(post: Post): void {
    this.posts = this.posts.filter((item) => item !== post);
    this.expanded.delete(post.id()!);

    const count = Number(app.forum.attribute<number>('flagCount') || 0);
    app.forum.pushAttributes({ flagCount: Math.max(0, count - 1) });

    const flags: any = (app as any).flags;
    if (flags && typeof flags.clear === 'function') flags.clear();
  }
}
