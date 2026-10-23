/*
 * Discourse 的用户卡片：点击作者头像或名字时在其旁边打开，含大头像、名字、
 * 分组、简介、“最后活跃…”、“加入于”以及“查看个人资料”/“发消息”按钮。
 * 点击外部、按 Esc 或导航时关闭。
 *
 * 整个页面只有一个卡片，挂载在 body 中自己的 <div> 上：放在帖子内部会被
 * 内容的 overflow 裁掉，并被 SubtreeRetainer 困住，而它不会无故重绘帖子。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import Separator from 'flarum/common/components/Separator';
import classList from 'flarum/common/utils/classList';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import UserControls from 'flarum/forum/utils/UserControls';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { fullDate, shortAge, shortDate } from '../../utils/dates';
import { t } from '../../utils/settings';
import { profileImageStyle } from '../../thirdparty/profileCover';
import { AUTHOR_FILTER_MAX_POSTS, authorPostCount, filterByAuthor } from '../authorFilter';
import { userIcons } from '../../utils/userIcons';

/** 卡片到头像的距离，以及到窗口边缘的距离。 */
const GAP = 8;
const EDGE = 16;

interface CardState {
  user: User;
  anchor: HTMLElement;
}

let state: CardState | null = null;
let root: HTMLElement | null = null;
const requested = new Set<string>();

function onDocumentEvent(event: Event) {
  if (!state) return;

  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') closeUserCard();
    return;
  }

  const target = event.target as Node;

  if (root?.contains(target) || state.anchor.contains(target)) return;

  closeUserCard();
}

function ensureRoot() {
  if (root) return;

  root = document.createElement('div');
  root.className = 'LcoyUserCardRoot';
  document.body.appendChild(root);

  m.mount(root, { view: () => (state ? <LcoyUserCard user={state.user} anchor={state.anchor} /> : null) });

  document.addEventListener('mousedown', onDocumentEvent, true);
  document.addEventListener('keydown', onDocumentEvent, true);
  window.addEventListener('popstate', () => closeUserCard());
}

export function openUserCard(user: User, anchor: HTMLElement): void {
  ensureRoot();

  // 在同一头像上再次点击会关闭，与 Discourse 一致。
  if (state && state.user === user && state.anchor === anchor) {
    closeUserCard();
    return;
  }

  state = { user, anchor };

  // 随帖子返回的用户可能信息不全（加入时间、
  // 计数）：每个会话拉取一次完整资料。
  const id = user.id();

  if (id && !requested.has(id) && user.joinTime() === undefined) {
    requested.add(id);
    app.store
      .find('users', id, {}, { errorHandler: () => {} })
      .catch(() => {})
      .then(() => m.redraw());
  }

  m.redraw();
}

/** 阅读时长（秒）采用 Discourse 的短格式："35 d"、"13 h"、"8 min"。 */
function readTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return app.translator.trans('lcoy-roselle.forum.age.minutes', { count: Math.max(1, minutes) }, true) as string;
  if (minutes < 60 * 24) return app.translator.trans('lcoy-roselle.forum.age.hours', { count: Math.round(minutes / 60) }, true) as string;

  return app.translator.trans('lcoy-roselle.forum.age.days', { count: Math.round(minutes / 60 / 24) }, true) as string;
}

export function closeUserCard(): void {
  if (!state) return;

  state = null;
  m.redraw();
}

interface LcoyUserCardAttrs extends ComponentAttrs {
  user: User;
  anchor: HTMLElement;
}

class LcoyUserCard extends Component<LcoyUserCardAttrs> {
  /**
   * Discourse 的卡片（.user-card，39em）：8em 的头像向上探出卡片 3.3em，
   * 角落带 flair；@用户名很大，下方是姓名和头衔；右侧是“发消息”和
   * “该主题中有 N 篇帖子”；之后是 fof/user-bio 的简介（2 行）、元数据和徽章。
   * 背景是个人资料的背景图，上面覆盖一层卡片颜色的薄纱。
   */
  view() {
    const user = this.attrs.user;
    const groups = ((user.groups() || []) as any[]).filter((group) => group && !group.isHidden?.());
    const flairGroup = groups.find((group) => group.icon());
    const lastSeen = user.lastSeenAt();
    const joined = user.joinTime();
    const timeRead = user.attribute<number | null | undefined>('lcoyTimeRead');
    const recentRead = user.attribute<number | null | undefined>('lcoyRecentTimeRead');
    const likes = user.attribute<number | null | undefined>('lcoyLikesReceived');
    const solutions = user.attribute<number | null | undefined>('bestAnswerCount');
    const showName = user.displayName() !== user.username();

    // flarum/messages 的“发消息”变成主按钮；其余
    // 控制项（管理操作）放进“…”里。
    const controls = UserControls.controls(user, this);
    const message = controls.has('sendMessage') ? (controls.get('sendMessage') as any) : null;
    if (message) controls.remove('sendMessage');
    const otherControls = controls.toArray().filter((item: any) => item && item.tag !== Separator);

    // 卡片从主题内部打开时显示“该主题中有 N 篇帖子”。
    const discussion = app.current.get('discussion');
    const stream = app.current.get('stream');
    const inTopic = discussion && stream ? authorPostCount(discussion, user) : 0;

    const meta1 = [
      lastSeen && !user.isOnline() && this.meta('seen', t('topic.user_card.last_seen'), shortAge(lastSeen), fullDate(lastSeen)),
      // 在线：只显示绿色的“当前在线”（省去“最后活跃”）。
      user.isOnline() && (
        <span className="LcoyUserCard-meta LcoyUserCard-online">
          <span className="LcoyUserCard-onlineNow">{t('user.stats.online')}</span>
        </span>
      ),
      joined && this.meta('joined', t('topic.user_card.joined'), shortDate(joined), fullDate(joined)),
      // “阅读 3 个月（最近 1 天）”：括号里是最近 60 天
      // 的时长，与 Discourse 的 `.metadata .time-read` 一致。
      typeof timeRead === 'number' &&
        timeRead > 0 &&
        this.meta(
          'read',
          t('topic.user_card.read'),
          typeof recentRead === 'number' && recentRead > 0 && recentRead < timeRead
            ? `${readTime(timeRead)} (${t('topic.user_card.read_recently', { time: readTime(recentRead) })})`
            : readTime(timeRead)
        ),
    ].filter(Boolean);
    const meta2 = [
      typeof likes === 'number' && this.meta('likes', t('topic.user_card.likes_received'), abbreviateNumber(likes), undefined, true),
      typeof solutions === 'number' && solutions > 0 && this.meta('solutions', t('topic.user_card.solutions'), abbreviateNumber(solutions)),
    ].filter(Boolean);

    // 已由 fof/user-bio 转义并格式化的 HTML。
    const bio = user.attribute<string | null | undefined>('bioHtml') || null;

    return (
      <div
        className={classList('LcoyUserCard', { 'LcoyProfile--hasCardBg': !!profileImageStyle(user)['--lcoy-user-card-bg'] })}
        role="dialog"
        aria-label={user.displayName()}
        style={{ '--usercard-color': user.color() || undefined, ...profileImageStyle(user) }}
      >
        <div className="LcoyUserCard-content">
          <div className="LcoyUserCard-first">
            <div className="LcoyUserCard-avatarWrapper">
              <Link className="LcoyUserCard-avatar" href={app.route.user(user)} onclick={closeUserCard}>
                <Avatar user={user} loading="eager" />
              </Link>
              {flairGroup && (
                <span className="LcoyUserCard-flair" title={flairGroup.nameSingular()} style={{ '--group-color': flairGroup.color() || undefined }}>
                  <Icon name={flairGroup.icon()} />
                </span>
              )}
            </div>

            <div className="LcoyUserCard-names">
              {/* 大号名称，同一行放图标（认证徽章），位于链接之外：
                  这样徽章的 popover 可用，且不会跳转到资料页。状态只放在下方的胶囊里。 */}
              <div className="LcoyUserCard-nameLine">
                <Link className="LcoyUserCard-name" href={app.route.user(user)} onclick={closeUserCard}>
                  <span className="LcoyUserCard-username">{user.displayName() || user.username()}</span>
                </Link>
                {userIcons(user, 'card')}
              </div>
              {/* 昵称（flarum/nicknames）突出显示，与帖子中一致；下面一行是 username。 */}
              {showName && <span className="LcoyUserCard-secondary">{user.username()}</span>}
            </div>

            <div className="LcoyUserCard-controls">
              {message && (
                <Button {...message.attrs} className="Button Button--primary LcoyUserCard-message" icon="far fa-envelope">
                  {message.children}
                </Button>
              )}
              {inTopic > 1 && discussion.postIds().length <= AUTHOR_FILTER_MAX_POSTS && (
                <Button
                  className="Button LcoyUserCard-filter"
                  icon="fas fa-filter"
                  onclick={() => {
                    closeUserCard();
                    filterByAuthor(stream, discussion, user);
                  }}
                >
                  {t('topic.user_card.posts_in_topic', { count: inTopic })}
                </Button>
              )}
              {otherControls.length > 0 && (
                <Dropdown
                  className="LcoyUserCard-more"
                  buttonClassName="Button Button--icon"
                  menuClassName="Dropdown-menu--right"
                  icon="fas fa-ellipsis-h"
                  caretIcon=""
                  label=""
                  helperText={null}
                  accessibleToggleLabel={t('topic.user_card.more')}
                >
                  {controls.toArray()}
                </Dropdown>
              )}
            </div>
          </div>

          {bio && <div className="LcoyUserCard-row LcoyUserCard-bio">{m.trust(bio)}</div>}
          {meta1.length > 0 && <div className="LcoyUserCard-row LcoyUserCard-metadata">{dotted(meta1)}</div>}
          {meta2.length > 0 && <div className="LcoyUserCard-row LcoyUserCard-metadata">{dotted(meta2)}</div>}
        </div>
      </div>
    );
  }

  /** Discourse 元数据的“标签 值”形式（.metadata .desc）。 */
  meta(key: string, label: string, value: string, title?: string, accent = false) {
    return (
      <span className={`LcoyUserCard-meta LcoyUserCard-meta--${key}`} title={title}>
        <span className="LcoyUserCard-metaLabel">{label}</span>{' '}
        <span className={classList('LcoyUserCard-metaValue', { 'LcoyUserCard-metaValue--accent': accent })}>{value}</span>
      </span>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<LcoyUserCardAttrs, this>) {
    super.oncreate(vnode);
    this.position();
  }

  onupdate(vnode: Mithril.VnodeDOM<LcoyUserCardAttrs, this>) {
    super.onupdate(vnode);
    this.position();
  }

  /**
   * 位于被点击的头像旁边；下方放不下则放在上方；
   * 且绝不超出窗口。在手机上由 CSS 居中。
   */
  position() {
    const card = this.element as HTMLElement;
    const anchor = this.attrs.anchor;

    if (!anchor.isConnected) {
      closeUserCard();
      return;
    }

    if (app.screen() === 'phone') {
      card.style.left = '';
      card.style.top = '';
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;

    // 与 Meta 一致：卡片的大头像（靠 CSS 负边距向上探出卡片 3.3em）
    // 位于被点击头像的右侧，高度几乎与它相同。
    let left = rect.right + GAP;
    let top = rect.top - 22;

    if (left + width > viewportWidth - EDGE) left = Math.max(EDGE, viewportWidth - width - EDGE);
    if (top + height > viewportHeight - EDGE && rect.top - GAP - height > EDGE) top = rect.top - GAP - height;

    card.style.left = `${left + window.scrollX}px`;
    card.style.top = `${top + window.scrollY}px`;

    // 左侧小箭头，指向被点击头像的中心；如果卡片不在它旁边
    // （右侧没空间或翻到了上方）则隐藏。
    const beside = left >= rect.right;
    const arrow = rect.top + rect.height / 2 - top;

    card.classList.toggle('LcoyUserCard--arrow', beside && arrow > 16 && arrow < height - 16);
    card.style.setProperty('--usercard-arrow', `${arrow}px`);
  }
}

/**
 * 在各项之间交替插入“•”。分隔符是独立元素，与各项同级：
 * 作为链接项内的伪元素时，它会继承链接的下划线并触发链接点击。
 */
function dotted(items: Mithril.Children[]): Mithril.Children[] {
  return items.flatMap((item, index) =>
    index === 0
      ? [item]
      : [
          <span className="LcoyUserCard-sep" aria-hidden="true">
            •
          </span>,
          item,
        ]
  );
}
