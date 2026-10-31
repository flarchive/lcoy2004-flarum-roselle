/*
 * 资料的“反应”标签页（类似 discourse-reactions）：此人给出的点赞和
 * 反应，合并为一个列表，从最新到最旧。在 Lcoy 中点赞就是“爱心”反应，
 * 因此显示为 ❤️。每项是其他标签页所用的 `user-stream-item`（作者头像、
 * 标题、分类、日期和摘录），外加反应行：emoji 和做出反应者的头像。
 *
 * 顺序和可见性来自 `/api/lcoy-user-reactions`
 *（extend/activity.php）；帖子来自 `/api/posts?filter[id]=…`。
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Placeholder from 'flarum/common/components/Placeholder';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import streamItem from '../streamItem';
import { leaveIfHidden } from './install';
import { extModule } from '../../thirdparty/settings';
import { isTagsEnabled } from '../../utils/tags';
import { t } from '../../utils/settings';

const PAGE_SIZE = 20;

/** API 的一行：`reactionId` 为 null 表示点赞。 */
interface Row {
  postId: number;
  reactionId: number | null;
}

interface ReactionGroup {
  post: Post;
  /** 唯一键：`like` 或反应 id。 */
  keys: string[];
}

export default class ReactionsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  private rows: Row[] = [];
  private loading = true;
  private hasMore = false;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    if (leaveIfHidden('reactions', user)) return;

    super.show(user);

    this.rows = [];
    this.load();
  }

  content() {
    const groups = this.groups();

    if (!groups.length) return this.loading ? <LoadingIndicator /> : <Placeholder text={t('user.nav.reactions_empty')} />;

    return (
      <div className="PostsUserPage LcoyReactionsUserPage">
        <ul className="PostList-discussions LcoyReactionsList">
          {groups.map((group) => (
            <li key={group.post.id()} data-id={group.post.id()}>
              {streamItem(group.post, { className: 'LcoyStreamItem--reaction', extra: this.reactionRow(group) })}
            </li>
          ))}
        </ul>
        {(this.loading || this.hasMore) && (
          <div className="PostList-loadMore">
            {this.loading ? (
              <LoadingIndicator />
            ) : (
              <Button className="Button" onclick={() => this.load()}>
                {app.translator.trans('core.forum.post_list.load_more_button')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  private reactionRow(group: ReactionGroup): Mithril.Children {
    return (
      <div className="LcoyStreamItem-reaction">
        {group.keys.map((key) => (
          <span className="LcoyStreamItem-reactionEmoji">{this.emoji(key)}</span>
        ))}
        <Avatar user={this.user} className="LcoyStreamItem-reactionAvatar" />
      </div>
    );
  }

  /** fof 的 emoji（与帖子中同一图片）；点赞是“heart”反应，或爱心图标。 */
  private emoji(key: string): Mithril.Children {
    const ReactionComponent = extModule<any>('fof-reactions', 'common/components/ReactionComponent');
    const reaction =
      key === 'like' ? app.store.all('reactions').find((item: any) => item.identifier?.() === 'heart') : app.store.getById('reactions', key);

    if (ReactionComponent && reaction) return m(ReactionComponent, { reaction });

    return key === 'like' ? <Icon name="fas fa-heart" className="LcoyStreamItem-likeIcon" /> : null;
  }

  /** 每篇帖子一项；同一帖子上的点赞和 fof 爱心只计一次。 */
  private groups(): ReactionGroup[] {
    const groups: ReactionGroup[] = [];
    const byPost = new Map<string, ReactionGroup>();
    const heart = app.store.all('reactions').find((item: any) => item.identifier?.() === 'heart');
    const heartId = heart ? String(heart.id()) : null;

    this.rows.forEach((row) => {
      const post = app.store.getById<Post>('posts', String(row.postId));

      if (!post || !post.discussion()) return;

      const key = row.reactionId === null || String(row.reactionId) === heartId ? 'like' : String(row.reactionId);
      let group = byPost.get(post.id()!);

      if (!group) {
        group = { post, keys: [] };
        byPost.set(post.id()!, group);
        groups.push(group);
      }

      if (!group.keys.includes(key)) group.keys.push(key);
    });

    return groups;
  }

  private async load(): Promise<void> {
    if (!this.user) return;

    this.loading = true;

    try {
      const page = await app.request<{ data: Row[]; hasMore: boolean }>({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/lcoy-user-reactions',
        params: { username: this.user.slug(), offset: this.rows.length, limit: PAGE_SIZE },
      });

      const ids = [...new Set(page.data.map((row) => String(row.postId)))].filter((id) => !app.store.getById('posts', id));

      if (ids.length) {
        const include = ['discussion', 'user'];
        if (isTagsEnabled()) include.push('discussion.tags');

        await app.store.find<Post[]>('posts', { filter: { id: ids.join(',') }, include: include.join(','), page: { limit: ids.length } } as any);
      }

      this.rows = [...this.rows, ...page.data];
      this.hasMore = page.hasMore;
    } catch {
      this.hasMore = false;
    } finally {
      this.loading = false;
      m.redraw();
    }
  }
}
