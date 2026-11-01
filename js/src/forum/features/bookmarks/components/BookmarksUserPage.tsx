/*
 * 个人资料页的“书签”标签（`/u/:username/bookmarks`），类似 Discourse
 * 的书签列表：顶部搜索，每项显示主题（含分类与标签）、书签名称与
 * 提醒、帖子摘录、收藏时间，以及包含“编辑”“移除提醒”“删除”的
 * “…”菜单。
 *
 * 书签属于个人内容：该标签仅在本人资料页显示，在他人资料页上
 * 页面只给出提示——无论如何，API 也只会返回请求者自己的书签。
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import type Bookmark from '../Bookmark';
import { bookmarksEnabled, clearPost, updateBookmark } from '../actions';
import { reminderLabel } from '../reminders';
import { discussionBadges, isTagsEnabled } from '../../../utils/tags';
import { fullDate, shortAge } from '../../../utils/dates';
import { t } from '../../../utils/settings';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

export default class BookmarksUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  bookmarks: Bookmark[] = [];
  // 初始即为加载中：首次渲染发生在请求之前，否则“没有
  // 书签”会在列表出现前闪烁。
  loading = true;
  moreResults = false;
  query = '';

  private loadedFor: User | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  /** 每次搜索都会使仍在途中的旧响应失效。 */
  private requestId = 0;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  onremove(vnode: Mithril.VnodeDOM<Attrs, this>) {
    super.onremove(vnode);

    clearTimeout(this.searchTimer);
  }

  show(user: User): void {
    super.show(user);

    // 完整资料到达时会再次执行 `show()`。
    if (this.loadedFor === user || !this.isOwnProfile()) return;

    this.loadedFor = user;
    this.refresh();
  }

  isOwnProfile(): boolean {
    return !!this.user && app.session.user === this.user;
  }

  content(): Mithril.Children {
    if (!bookmarksEnabled() || !this.isOwnProfile()) {
      return <p className="LcoyBookmarks-private">{t('bookmarks.page.private')}</p>;
    }

    return (
      <div className="LcoyBookmarks">
        <div className="LcoyBookmarks-toolbar">{this.toolbarItems().toArray()}</div>
        {this.listView()}
      </div>
    );
  }

  toolbarItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    items.add(
      'search',
      <div className="LcoyBookmarks-search">
        <Icon name="fas fa-search" className="LcoyBookmarks-searchIcon" />
        <input
          className="FormControl"
          type="search"
          value={this.query}
          placeholder={t('bookmarks.page.search_placeholder')}
          aria-label={t('bookmarks.page.search_placeholder')}
          oninput={(event: InputEvent) => this.search((event.target as HTMLInputElement).value)}
        />
      </div>,
      100
    );

    return items;
  }

  listView(): Mithril.Children {
    const bookmarks = this.bookmarks.filter((bookmark) => bookmark.exists);

    if (this.loading && !bookmarks.length) return <LoadingIndicator display="block" />;

    if (!bookmarks.length) {
      return (
        <div className="LcoyBookmarks-empty">
          <Icon name="far fa-bookmark" className="LcoyBookmarks-emptyIcon" />
          <p>{this.query ? t('bookmarks.page.no_results', { query: this.query }) : t('bookmarks.page.empty')}</p>
          {!this.query && <p className="LcoyBookmarks-emptyHelp">{t('bookmarks.page.empty_help')}</p>}
        </div>
      );
    }

    return (
      <div className="LcoyBookmarkList" role="table" aria-label={t('bookmarks.page.title')}>
        <div className="LcoyBookmarkList-head" role="row">
          <span className="LcoyBookmarkList-headTopic" role="columnheader">
            {t('bookmarks.page.column_topic')}
          </span>
          <span className="LcoyBookmarkList-headDate" role="columnheader">
            {t('bookmarks.page.column_date')}
          </span>
          <span className="LcoyBookmarkList-headActions" role="columnheader" />
        </div>
        <ul className="LcoyBookmarkList-items" role="rowgroup">
          {bookmarks.map((bookmark) => this.item(bookmark))}
        </ul>
        {this.moreResults && (
          <div className="LcoyBookmarkList-more">
            <Button className="Button" loading={this.loading} onclick={() => this.loadMore()}>
              {t('bookmarks.page.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  item(bookmark: Bookmark): Mithril.Children {
    const post = bookmark.post() || null;
    const discussion = post ? post.discussion() : null;

    // 被“编辑书签”弹窗删除（该弹窗不认识此列表）。
    if (!bookmark.exists || !post || !discussion) return null;

    const createdAt = bookmark.createdAt();
    const reminderAt = bookmark.reminderAt();
    const expired = !!reminderAt && (!!bookmark.remindedAt() || reminderAt.getTime() <= Date.now());
    const excerpt = post.contentPlain();

    return (
      <li className="LcoyBookmarkList-item" role="row" key={bookmark.id()}>
        <div className="LcoyBookmarkList-main" role="cell">
          <Avatar user={post.user() || null} className="LcoyBookmarkList-avatar" />
          <div className="LcoyBookmarkList-body">
            <Link className="LcoyBookmarkList-title" href={app.route.post(post)}>
              <Icon name="fas fa-bookmark" className="LcoyBookmarkList-titleIcon" />
              {discussion.title()}
            </Link>

            {isTagsEnabled() && <div className="LcoyBookmarkList-badges">{discussionBadges(discussion)}</div>}

            {(bookmark.name() || reminderAt) && (
              <div className="LcoyBookmarkList-meta">
                {bookmark.name() && (
                  <span className="LcoyBookmarkList-metaItem LcoyBookmarkList-name">
                    <Icon name="fas fa-tag" />
                    <span>{bookmark.name()}</span>
                  </span>
                )}
                {reminderAt && (
                  <span
                    className={classList('LcoyBookmarkList-metaItem LcoyBookmarkList-reminder', { 'is-expired': expired })}
                    title={fullDate(reminderAt)}
                  >
                    <Icon name="far fa-clock" />
                    <span>{t(expired ? 'bookmarks.page.reminder_past' : 'bookmarks.page.reminder_future', { date: reminderLabel(reminderAt) })}</span>
                  </span>
                )}
              </div>
            )}

            {excerpt && <p className="LcoyBookmarkList-excerpt">{truncate(excerpt, 220)}</p>}
          </div>
        </div>

        <div className="LcoyBookmarkList-date" role="cell">
          {createdAt && (
            <time datetime={createdAt.toISOString()} title={fullDate(createdAt)}>
              {shortAge(createdAt)}
            </time>
          )}
        </div>

        <div className="LcoyBookmarkList-actions" role="cell">
          <Dropdown
            className="LcoyBookmarkList-menu"
            buttonClassName="Button Button--icon Button--flat"
            menuClassName="Dropdown-menu--right"
            icon="fas fa-ellipsis-h"
            caretIcon=""
            label=""
            accessibleToggleLabel={t('bookmarks.page.actions')}
          >
            {this.actionItems(bookmark, post).toArray()}
          </Dropdown>
        </div>
      </li>
    );
  }

  actionItems(bookmark: Bookmark, post: Post): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    items.add(
      'edit',
      <Button icon="fas fa-pencil-alt" onclick={() => app.modal.show(() => import('./BookmarkModal'), { post })}>
        {t('bookmarks.page.edit')}
      </Button>,
      100
    );

    if (bookmark.reminderAt()) {
      items.add(
        'clearReminder',
        <Button icon="far fa-bell-slash" onclick={() => updateBookmark(post, bookmark, { reminderAt: null }).catch(() => {})}>
          {t('bookmarks.page.clear_reminder')}
        </Button>,
        90
      );
    }

    items.add(
      'delete',
      <Button icon="far fa-trash-alt" className="LcoyBookmarkList-delete" onclick={() => this.remove(bookmark, post)}>
        {t('bookmarks.page.delete')}
      </Button>,
      -100
    );

    return items;
  }

  search(value: string): void {
    this.query = value;

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refresh(), SEARCH_DELAY_MS);
  }

  refresh(): void {
    this.bookmarks = [];
    this.load(0);
  }

  loadMore(): void {
    this.load(this.bookmarks.length);
  }

  load(offset: number): void {
    const requestId = ++this.requestId;
    const include = ['post', 'post.discussion', 'post.user'];

    // 标签仅在使用 flarum/tags 时存在：没有它却请求标签会导致整个请求失败。
    if (isTagsEnabled()) include.push('post.discussion.tags');

    this.loading = true;
    m.redraw();

    app.store
      .find<Bookmark[]>('bookmarks', {
        filter: this.query.trim() ? { q: this.query.trim() } : {},
        include: include.join(','),
        page: { offset, limit: PAGE_SIZE },
      } as any)
      .then((results: any) => {
        if (requestId !== this.requestId) return;

        this.bookmarks = offset ? [...this.bookmarks, ...results] : results.slice();
        this.moreResults = !!results.payload?.links?.next;
      })
      .catch(() => {})
      .finally(() => {
        if (requestId !== this.requestId) return;

        this.loading = false;
        m.redraw();
      });
  }

  remove(bookmark: Bookmark, post: Post): void {
    // 若设置了待发送的提醒，删除书签也会丢失该提醒：Discourse 在此情况下
    // 会请求确认，且仅在这种情况下。
    if (bookmark.hasPendingReminder() && !window.confirm(t('bookmarks.page.delete_confirm'))) return;

    bookmark
      .delete()
      .then(() => {
        clearPost(post);
        this.bookmarks = this.bookmarks.filter((other) => other !== bookmark);
        app.alerts.show({ type: 'success' }, t('bookmarks.alerts.removed'));
      })
      .catch(() => {})
      .finally(() => m.redraw());
  }
}
