/*
 * 一个帖子嵌在另一个帖子中，类似 Discourse 的 “embedded posts”：
 * 在帖子下方展开的回复，或在其上方展开的被回复帖子。内容是服务端已渲染的
 * HTML；当帖子只作为关联返回（没有 HTML）时，嵌入方会先拉取再显示。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import classList from 'flarum/common/utils/classList';
import type Post from 'flarum/common/models/Post';

import { fullDate, shortAge } from '../../utils/dates';
import { t } from '../../utils/settings';
import { userIcons } from '../../utils/userIcons';

export interface EmbeddedPostAttrs extends ComponentAttrs {
  post: Post;
  /** 跳转到帖子的链接指向哪边：上方（被回复的）还是下方（回复）。 */
  direction: 'up' | 'down';
  className?: string;
}

export default class EmbeddedPost extends Component<EmbeddedPostAttrs> {
  view() {
    const post = this.attrs.post;
    const user = post.user();
    const html = post.contentHtml();
    const time = post.createdAt();

    return (
      <article className={classList('LcoyEmbeddedPost', this.attrs.className)} data-number={post.number()}>
        <div className="LcoyEmbeddedPost-side">
          <Avatar user={user || null} />
        </div>
        <div className="LcoyEmbeddedPost-main">
          <header className="LcoyEmbeddedPost-header">
            <span className="LcoyEmbeddedPost-name">{username(user || null)}</span>
            {userIcons(user || null, 'embedded')}
            <Link className="LcoyEmbeddedPost-link" href={app.route.post(post)} title={t('topic.embedded.go_to_post')}>
              {time ? (
                <time dateTime={time.toISOString()} title={fullDate(time)}>
                  {shortAge(time)}
                </time>
              ) : null}
              <Icon name={this.attrs.direction === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'} />
            </Link>
          </header>
          <div className="LcoyEmbeddedPost-body">{html ? m.trust(html) : <p>{post.contentPlain() || ''}</p>}</div>
        </div>
      </article>
    );
  }
}

/** 用一次请求拉取缺少 HTML 的帖子。 */
export function loadMissingContent(posts: Post[]): Promise<unknown> {
  const missing = posts.filter((post) => !post.contentHtml()).map((post) => post.id()!);

  if (!missing.length) return Promise.resolve();

  return app.store.find('posts', { filter: { id: missing.join(',') } }, undefined, { errorHandler: () => {} });
}

export function embeddedLoading() {
  return <LoadingIndicator size="small" display="block" className="LcoyEmbeddedPost-loading" />;
}
