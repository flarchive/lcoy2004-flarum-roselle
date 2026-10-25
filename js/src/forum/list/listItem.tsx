/*
 * Discourse 主题列表的一行：[主题 | 发帖人 | 回复 |
 * 浏览量 | 活动] 于桌面端；移动端显示头像、标题和计数。
 *
 * 只改动 DiscussionListItem 的 ItemList：其他扩展放入
 * infoItems（置顶帖摘录、实时输入状态）和 statsItems 的内容
 * 仍会显示，只是放在 Discourse 对应的位置。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import IndexPage from 'flarum/forum/components/IndexPage';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import Tooltip from 'flarum/common/components/Tooltip';
import listItems from 'flarum/common/helpers/listItems';
import highlight from 'flarum/common/helpers/highlight';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import stringToColor from 'flarum/common/utils/stringToColor';
import { truncate } from 'flarum/common/utils/string';
import type ItemList from 'flarum/common/utils/ItemList';
import Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { fullDate, shortAge } from '../utils/dates';
import { discussionBadges } from '../utils/tags';
import { activityCold, discussionViews, repliesHeat } from './metrics';
import { viewsHeat, viewsNumber } from '../utils/views';

/**
 * `lcoyParticipants` 属性（extend/topic.php）：只包含该行头像所需的
 * 数据。它以普通对象形式传入，而不是 `users` 关系，以免
 * 列表为每个用户付出序列化（和查询）开销。
 */
interface Participant {
  id: string;
  username: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  avatarSrcset: string | null;
}

/** 已由该行加载的用户，格式与属性相同。 */
function fromUser(user: User): Participant {
  return {
    id: String(user.id()),
    username: user.username(),
    displayName: user.displayName(),
    slug: user.slug(),
    avatarUrl: user.avatarUrl(),
    avatarSrcset: user.avatarSrcset(),
  };
}

/**
 * 新行会在别处绘制（或省略）的 infoItems 键。
 *
 * `discussion-views` 是 fof/discussion-views 的 "👁 56"：它的数字与
 * 主题的浏览量列相同（主题读取该扩展的 `views`
 * 属性），所以这只眼睛会重复同样的信息。
 *
 * fof/synopsis 把同一段摘录放在两个键中（`excerpt` 用于
 * 桌面/平板，`excerptM` 用于移动端，各自在另一种
 * 屏幕尺寸下隐藏）。由于主题在任何屏幕上都以 Discourse 的外观
 * 绘制摘录（`.LcoyTopic-excerpt`），两者都从列表中移除 ——
 * 否则在移动端 `excerptM` 会与主题的摘录并排显示，造成重复。
 */
const MOVED_INFO = ['tags', 'terminalPost', 'excerpt', 'excerptM', 'discussion-views'];

/**
 * MinimalDiscussionListItem（搜索弹窗的结果）继承自这个
 * 类；在那里，核心的紧凑行仍然有效。CSS 类是唯一
 * 稳定的识别方式 —— 该模块甚至可能尚未加载。（因此
 * 主题不扩展 elementAttrs：该检查会调用 elementAttrs 并陷入
 * 循环；行的 CSS 针对 `.LcoyList .DiscussionListItem`。）
 */
function isMinimal(item: DiscussionListItem): boolean {
  return String(item.elementAttrs().className || '').includes('MinimalDiscussionListItem');
}

function heatClass(heat: string | null, kind: 'heat' | 'cold' = 'heat'): string | undefined {
  return heat && forumBool('lcoyListHeat', true) ? `LcoyCell--${kind}-${heat}` : undefined;
}

/**
 * 该列的头像，由精简对象绘制：有图片时用 `<img>`，
 * 没有时用名称派生颜色上的首字母 —— 与核心的
 * `Avatar` 相同的回退方式，无需 `User` 模型。
 */
function posterAvatar(poster: Participant, role: string, className = ''): Mithril.Children {
  const label = `${poster.displayName}: ${role}`;

  return (
    <Tooltip text={label}>
      <Link href={app.route('user', { username: poster.slug })} className={classList('LcoyPosters-avatar', className)} aria-label={label}>
        {poster.avatarUrl ? (
          <img className="Avatar" src={poster.avatarUrl} srcSet={poster.avatarSrcset || undefined} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="Avatar" style={{ '--avatar-bg': `#${stringToColor(poster.displayName)}` }} role="img" aria-label={poster.displayName}>
            {poster.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}

export default function installListItem(): void {
  // 从主题返回时，Discourse 会用 --tertiary-low 点亮该行
  // 并在 2.5 秒后消失（`.topic-list-item.highlighted`）。核心已经记录
  // 是哪一个（lastDiscussion）并滚动到它；主题只负责点亮该行。
  extend(IndexPage.prototype, 'oncreate', function (this: IndexPage) {
    const last = this.lastDiscussion;

    if (!last) return;

    const row = this.element?.querySelector(`li[data-id="${last.id()}"] .DiscussionListItem`);

    if (!row) return;

    row.classList.add('LcoyListItem--highlighted');
    row.addEventListener('animationend', () => row.classList.remove('LcoyListItem--highlighted'), { once: true });
  });

  extend(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (isMinimal(this)) return;

    // 左侧的大头像和核心的统计列移除：
    // Discourse 在各自的列中显示发帖人和数字。
    items.remove('author');
    items.remove('stats');

    // 仅在移动端显示（CSS 在桌面端隐藏），与 Discourse 的 48px 头像相同。
    items.add('lcoyAvatar', avatarView(this), 100);

    if (forumBool('lcoyListPosters', true)) {
      items.add('lcoyPosters', postersView(this), 60);
    }

    items.add('lcoyReplies', repliesView(this), 50);

    if (forumBool('lcoyListViews', true)) {
      // 始终绘制：是否显示该列由整个列表决定
      // （DiscussionList 上的类），而不是每一行。数字来自主题或
      // fof/discussion-views —— 见 ./metrics 中的 `discussionViews`。
      items.add('lcoyViews', viewsView(this), 40);
    }

    items.add('lcoyActivity', activityView(this), 30);
  });

  // tryhackx/flarum-thumb-sliders 会把滑块注入任何 contentItems，
  // 包括搜索弹窗中的 MinimalDiscussionListItem，那里行是
  // 紧凑的，放不下它。它在所有扩展之后运行，所以使用
  // override（而不是 extend）。
  override(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, original: () => ItemList<Mithril.Children>) {
    const items = original();

    if (isMinimal(this)) items.remove('thumbSlider');

    return items;
  });

  override(DiscussionListItem.prototype, 'mainView', function (this: DiscussionListItem, original: () => Mithril.Children) {
    if (isMinimal(this)) return original();

    const discussion = this.attrs.discussion;
    const jumpTo = this.getJumpTo();
    const info = this.infoItems();
    const searching = !!this.attrs.params.q;

    // 置顶帖的摘录是可选的；搜索的摘录不是 —— 它就是搜索结果。
    const excerpt =
      info.has('excerpt') && (searching || forumBool('lcoyListExcerpts', true)) ? excerptView(this, info.get('excerpt'), searching) : null;

    MOVED_INFO.forEach((key) => info.remove(key));

    // 扩展的 statsItems（例如点赞）没有自己的列：
    // 放到标签行。回复数已经是独立列。
    const extraStats = this.statsItems();
    extraStats.remove('replyCount');

    const badgeList = discussion.badges();

    // 在 Discourse 中，挂锁（已关闭）位于图钉（置顶）之前。
    if (badgeList.has('locked')) badgeList.setPriority('locked', 1000);

    const badges = badgeList.toArray();

    return (
      <div className="DiscussionListItem-main LcoyTopic">
        <h2 className="DiscussionListItem-title LcoyTopic-titleLine">
          {badges.length > 0 && <span className="LcoyTopic-status">{badges}</span>}
          <Link href={app.route.discussion(discussion, jumpTo)} className="LcoyTopic-title">
            {highlight(discussion.title(), this.highlightRegExp)}
          </Link>
          {unreadView(this)}
        </h2>
        <div className="LcoyTopic-meta">
          {discussionBadges(discussion)}
          {!info.isEmpty() && <ul className="DiscussionListItem-info LcoyTopic-info">{listItems(info.toArray())}</ul>}
          {!extraStats.isEmpty() && <span className="LcoyTopic-stats">{extraStats.toArray()}</span>}
        </div>
        {excerpt ? <div className="LcoyTopic-excerpt">{excerpt}</div> : null}
      </div>
    );
  });
}

/**
 * "新主题"（从未打开）的小圆点，或显示未读数的胶囊，与
 * Discourse 相同。两者在点击时都标记为已读，与核心的计数一致。
 */
function unreadView(item: DiscussionListItem): Mithril.Children {
  const discussion = item.attrs.discussion;

  if (!app.session.user || !discussion.isUnread()) return null;

  const neverRead = !discussion.lastReadPostNumber();
  const label = neverRead ? t('list.new_topic') : t('list.unread_count', { count: discussion.unreadCount() });

  return (
    <button
      type="button"
      className={classList('Button--ua-reset LcoyUnread', neverRead ? 'LcoyUnread--new' : 'LcoyUnread--count')}
      title={`${label}: ${t('list.mark_read')}`}
      aria-label={`${label}: ${t('list.mark_read')}`}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        item.markAsRead();
      }}
    >
      {neverRead ? null : abbreviateNumber(discussion.unreadCount())}
    </button>
  );
}

/**
 * 被截断时，置顶帖的摘录以 "… 阅读更多" 结尾，与 Discourse 的
 * `.topic-excerpt-more` 相同。flarum/sticky 在 div 中提供已
 * 截断的文本；主题重新截断，以便把链接放在同一
 * 行。搜索的摘录（带高亮的片段）保持原样。
 */
function excerptView(item: DiscussionListItem, original: Mithril.Children, searching: boolean): Mithril.Children {
  const discussion = item.attrs.discussion;
  const text = discussion.attribute<string | null>('firstPostExcerpt');

  if (searching || typeof text !== 'string' || !text) return original;

  const limit = 175;

  if (text.length <= limit) return text;

  return [
    truncate(text, limit),
    ' ',
    <Link href={app.route.discussion(discussion)} className="LcoyTopic-excerptMore">
      {t('list.read_more')}
    </Link>,
  ];
}

function avatarView(item: DiscussionListItem): Mithril.Children {
  const user = item.attrs.author || item.attrs.discussion.user();

  return (
    <div className="LcoyListItem-avatar">
      {user ? (
        <Link href={app.route.user(user)} aria-label={user.displayName()}>
          <Avatar user={user} title="" />
        </Link>
      ) : (
        <Avatar user={null} title="" />
      )}
    </div>
  );
}

function postersView(item: DiscussionListItem): Mithril.Children {
  const discussion: Discussion = item.attrs.discussion;
  const author = item.attrs.author || discussion.user();
  const last = discussion.replyCount() ? discussion.lastPostedUser() : null;
  const relevantPost = item.attrs.params.q ? discussion.mostRelevantPost() : null;
  const relevant = relevantPost ? relevantPost.user() : null;

  // Discourse 的 "最后发帖人"（`a.latest`）：最后回复的人
  // 或（没有回复时）作者本人。它是平板上唯一保留的头像。
  const latest = last || author;

  // API 为每个讨论发送最多五位参与者（作者在首位，
  // 然后是最近的）：前四个直接显示，第五个变成 "+"。
  const participants = discussion.attribute<Participant[]>('lcoyParticipants') || [];

  let posters: Participant[];

  if (participants.length) {
    posters = participants;
  } else {
    // 没有该属性（搜索结果、旧 payload）时：用该行已有的内容
    // 组装 —— 作者、相关帖子和最后发帖人。
    const seen = new Set<string>();
    const fallback: Participant[] = [];

    const push = (user: User | null | false | undefined) => {
      if (!user || seen.has(user.id()!)) return;

      seen.add(user.id()!);
      fallback.push(fromUser(user));
    };

    push(author);
    push(relevant);
    push(last);

    posters = fallback;
  }

  const shown = posters.slice(0, 4);
  const authorId = author ? author.id() : undefined;
  const latestId = latest ? latest.id() : undefined;

  const avatars = shown.map((poster) => {
    const isLatest = !!latestId && poster.id === latestId;
    const role = poster.id === authorId ? t('list.original_poster') : isLatest ? t('list.most_recent_poster') : t('list.participant');

    return posterAvatar(
      poster,
      role,
      classList({
        'LcoyPosters-avatar--latest': isLatest,
        // 同样最后发帖的作者会发光，前提是旁边还有其他
        // 头像（`.avatar.latest:not(.single)`）。
        'LcoyPosters-avatar--glow': isLatest && poster.id === shown[0].id && shown.length > 1,
      })
    );
  });

  return (
    <div className="LcoyCell LcoyCell--posters LcoyPosters">
      {avatars}
      {posters.length > shown.length ? (
        <span className="LcoyPosters-more" title={t('list.more_participants')} aria-label={t('list.more_participants')}>
          +
        </span>
      ) : null}
    </div>
  );
}

function repliesView(item: DiscussionListItem): Mithril.Children {
  const count = item.attrs.discussion.replyCount() ?? 0;

  return (
    <div className={classList('LcoyCell LcoyCell--replies', heatClass(repliesHeat(count)))}>
      <span aria-hidden="true">{abbreviateNumber(count)}</span>
      <span className="visually-hidden">{t('list.replies_a11y', { count })}</span>
    </div>
  );
}

function viewsView(item: DiscussionListItem): Mithril.Children {
  const views = discussionViews(item.attrs.discussion);

  return (
    <div className={classList('LcoyCell LcoyCell--views', views !== null && heatClass(viewsHeat(views)))}>
      {/* Discourse 的 `dNumber … numberKey="views_long"`："1,2k" 加上完整的 title。 */}
      {views === null ? null : viewsNumber(views)}
    </div>
  );
}

function activityView(item: DiscussionListItem): Mithril.Children {
  const discussion: Discussion = item.attrs.discussion;
  const created = discussion.createdAt();
  const last = discussion.lastPostedAt() || created;
  const title = [
    t('list.created_at', { date: fullDate(created) }),
    discussion.replyCount() ? t('list.last_reply_at', { date: fullDate(last) }) : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={classList('LcoyCell LcoyCell--activity', heatClass(activityCold(discussion), 'cold'))} title={title}>
      <Link href={app.route.discussion(discussion, discussion.lastPostNumber() ?? undefined)} className="LcoyActivity">
        {shortAge(last)}
      </Link>
    </div>
  );
}
