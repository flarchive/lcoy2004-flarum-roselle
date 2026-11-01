/*
 * Discourse 的 `user-stream-item`：48px 头像、作为链接的主题标题、
 * 下方的分类和日期以及正文开头。用于资料的帖子标签页
 *（帖子、点赞、提及、投票、已解决）以及“反应”标签页，
 * 后者会额外添加反应行（`extra`）。
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { discussionBadges } from '../utils/tags';
import { fullDate, mediumAge } from '../utils/dates';

/** 摘录的长度（Discourse 的 `excerpt`）。 */
const STREAM_EXCERPT = 300;

export interface StreamItemOptions {
  className?: string;
  /** 位于头部和摘录之间（“反应”标签页的反应）。 */
  extra?: Mithril.Children;
}

export default function streamItem(post: Post, options: StreamItemOptions = {}): Mithril.Children {
  const discussion = post.discussion() as Discussion | false;
  const user = post.user() as User | false;
  const createdAt = post.createdAt();

  return (
    <div className={classList('PostListItem LcoyStreamItem', options.className)}>
      <div className="LcoyStreamItem-header">
        {user ? (
          <Link href={app.route.user(user)} className="LcoyStreamItem-avatar" tabindex="-1" aria-hidden="true">
            <Avatar user={user} />
          </Link>
        ) : (
          <span className="LcoyStreamItem-avatar">
            <Avatar user={null} />
          </span>
        )}
        <div className="LcoyStreamItem-details">
          <div className="LcoyStreamItem-title">
            <Link href={app.route.post(post)}>{discussion ? discussion.title() : ''}</Link>
          </div>
          <div className="LcoyStreamItem-meta">
            {discussion && discussionBadges(discussion)}
            {createdAt && (
              <time className="LcoyStreamItem-date" datetime={createdAt.toISOString()} title={fullDate(createdAt)}>
                {mediumAge(createdAt)}
              </time>
            )}
          </div>
        </div>
      </div>
      {options.extra}
      <div className="LcoyStreamItem-excerpt">{truncate(post.contentPlain() || '', STREAM_EXCERPT)}</div>
    </div>
  );
}
