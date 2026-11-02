/*
 * 搜索页面的结果，与 Discourse 一致：左侧头像、大标题、分类和标签，
 * 以及“日期 - 摘录”，其中搜索词加粗显示。
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import highlight from 'flarum/common/helpers/highlight';
import username from 'flarum/common/helpers/username';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { shortDate } from '../../../utils/dates';
import { categoryBadge, discussionBadges, labelBadge, type LcoyTag } from '../../../utils/tags';
import { isCategory } from './query';

/** 摘录长度（字符数）——与 Discourse 的 `blurb` 一致。 */
const BLURB_LENGTH = 220;

function avatarLink(user: User | null | false | undefined): Mithril.Children {
  return (
    <div className="LcoySearchResult-avatar">
      {user ? (
        <Link href={app.route.user(user)} aria-label={user.displayName()} tabindex="-1">
          <Avatar user={user} title="" />
        </Link>
      ) : (
        <Avatar user={null} title="" />
      )}
    </div>
  );
}

function blurb(post: Post | null | false | undefined, pattern: RegExp | undefined): Mithril.Children {
  if (!post) return null;

  const text = (post.contentPlain() || '').replace(/\s+/g, ' ').trim();
  const date = post.createdAt();

  return (
    <div className="LcoySearchResult-blurb">
      {date && <span className="LcoySearchResult-date">{shortDate(date)}</span>}
      {date && text ? ' - ' : null}
      {text ? highlight(text, pattern, BLURB_LENGTH) : null}
    </div>
  );
}

/**
 * 结果尚未到达（搜索的第一页）：各行沿用真实结果的类名（头像、标题、
 * 徽章以及两行摘录），用骨架条代替文本，使结果到达时正落在骨架
 * 所在的位置。
 */
export function resultSkeleton(rows = 5): Mithril.Children[] {
  const line = (width: string) => <span className="LcoySkeleton LcoySkeleton--line" style={{ width }} />;
  const titles = ['58%', '42%', '66%', '36%', '50%'];

  return Array.from({ length: rows }, (_, index) => (
    <li className="LcoySearchResult LcoySearchResult--skeleton" key={`skeleton-${index}`} aria-hidden="true">
      <div className="LcoySearchResult-avatar">
        <span className="Avatar LcoySkeleton" />
      </div>
      <div className="LcoySearchResult-main">
        <div className="LcoySearchResult-titleLine">{line(titles[index % titles.length])}</div>
        <div className="LcoySearchResult-meta">{line(index % 2 ? '7em' : '5em')}</div>
        <div className="LcoySearchResult-blurb">
          {line('100%')}
          {line('64%')}
        </div>
      </div>
    </li>
  ));
}

export function discussionResult(discussion: Discussion, pattern: RegExp | undefined): Mithril.Children {
  // 有文本时，摘录取自匹配度最高的帖子；无文本（仅筛选）时，
  // 取主题的首帖。
  const post = discussion.mostRelevantPost() || discussion.firstPost();
  const user = (post && post.user()) || discussion.user();
  const statusBadges = discussion.badges().toArray();
  const near = post && post.number() > 1 ? post.number() : undefined;

  return (
    <li className="LcoySearchResult" key={`d${discussion.id()}`} data-id={discussion.id()}>
      {avatarLink(user)}
      <div className="LcoySearchResult-main">
        <div className="LcoySearchResult-titleLine">
          {statusBadges.length > 0 && <span className="LcoySearchResult-status">{statusBadges}</span>}
          <Link className="LcoySearchResult-title" href={app.route.discussion(discussion, near)}>
            {highlight(discussion.title(), pattern)}
          </Link>
        </div>
        <div className="LcoySearchResult-meta">{discussionBadges(discussion)}</div>
        {blurb(post, pattern)}
      </div>
    </li>
  );
}

export function postResult(post: Post, pattern: RegExp | undefined): Mithril.Children {
  const discussion = post.discussion();

  if (!discussion) return null;

  return (
    <li className="LcoySearchResult LcoySearchResult--post" key={`p${post.id()}`} data-id={post.id()}>
      {avatarLink(post.user())}
      <div className="LcoySearchResult-main">
        <div className="LcoySearchResult-titleLine">
          <Link className="LcoySearchResult-title" href={app.route.post(post)}>
            {highlight(discussion.title(), pattern)}
          </Link>
          {post.number() > 1 && <span className="LcoySearchResult-number">#{post.number()}</span>}
        </div>
        <div className="LcoySearchResult-meta">
          {discussionBadges(discussion)}
          <span className="LcoySearchResult-author">{username(post.user())}</span>
        </div>
        {blurb(post, pattern)}
      </div>
    </li>
  );
}

export function tagResult(tag: LcoyTag, pattern: RegExp | undefined): Mithril.Children {
  const description = tag.description();

  return (
    <li className="LcoySearchResult LcoySearchResult--tag" key={`t${tag.id()}`}>
      <div className="LcoySearchResult-main">
        <div className="LcoySearchResult-titleLine">{isCategory(tag) ? categoryBadge(tag) : labelBadge(tag)}</div>
        {description && <div className="LcoySearchResult-blurb">{highlight(description, pattern, BLURB_LENGTH)}</div>}
      </div>
      <div className="LcoySearchResult-count">{tag.discussionCount()}</div>
    </li>
  );
}

export function userResult(user: User, pattern: RegExp | undefined): Mithril.Children {
  const name = user.displayName();
  const handle = user.username();

  return (
    <li className="LcoySearchResult LcoySearchResult--user" key={`u${user.id()}`}>
      {avatarLink(user)}
      <div className="LcoySearchResult-main">
        <div className="LcoySearchResult-titleLine">
          <Link className="LcoySearchResult-title" href={app.route.user(user)}>
            {highlight(name, pattern)}
          </Link>
          {handle !== name && <span className="LcoySearchResult-handle">@{highlight(handle, pattern)}</span>}
        </div>
      </div>
    </li>
  );
}
