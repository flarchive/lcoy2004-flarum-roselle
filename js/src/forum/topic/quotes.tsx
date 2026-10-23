/*
 * Discourse 风格的引用（aside.quote）：mentions 把引用写成
 * `<blockquote><p><a class="PostMention">某某</a> 文本…</p>`，而 Discourse 会在
 * 引用上方显示一个“头像 某某：”的头部，带跳转到被引用帖子的箭头。
 * 主题在 blockquote 内部、基于已渲染的 HTML 构建这个头部。
 *
 * 只在帖子的块内部添加节点（绝不替换块的位置）：Mithril 会保存 m.trust 的
 * 顶层节点，以便在内容变化时移除它们，被替换的块会残留下来。
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';

import { t } from '../utils/settings';
import { iconMarkup } from '../icons';

const DONE = 'lcoyQuote';

/** 被引用帖子的作者：帖子已加载时由帖子得出；否则按显示名查找。 */
function quotedUser(mention: HTMLAnchorElement): User | null {
  const post = app.store.getById<Post>('posts', mention.dataset.id || '');
  const user = post ? post.user() : null;

  if (user) return user;

  const name = (mention.textContent || '').replace(/^@/, '').trim();

  return app.store.all<User>('users').find((candidate) => candidate.displayName() === name) || null;
}

function decorateQuote(quote: HTMLElement): void {
  const first = quote.firstElementChild;

  if (!first || first.tagName !== 'P') return;

  // 提及必须位于段落开头：在文本中间时它只是普通提及。
  const leading = Array.from(first.childNodes).find((node) => node.nodeType !== Node.TEXT_NODE || (node.textContent || '').trim() !== '');

  if (!(leading instanceof HTMLAnchorElement) || !leading.classList.contains('PostMention')) return;

  const title = document.createElement('div');
  title.className = 'LcoyQuote-title';

  const user = quotedUser(leading);

  if (user) {
    const avatar = document.createElement('span');
    m.render(avatar, <Avatar user={user} />);
    title.appendChild(avatar.firstElementChild || avatar);
  }

  // 提及本身移入头部：悬停预览和跳转到帖子的点击都保留——
  // mentions 已经给它绑定好了。
  const name = document.createElement('span');
  name.className = 'LcoyQuote-name';
  name.appendChild(leading);
  name.appendChild(document.createTextNode(':'));
  title.appendChild(name);

  const controls = document.createElement('span');
  controls.className = 'LcoyQuote-controls';

  const back = document.createElement('a');
  back.href = leading.href;
  back.title = t('topic.post.go_to_quoted');
  back.setAttribute('aria-label', back.title);
  back.innerHTML = iconMarkup('fas fa-arrow-up');
  back.addEventListener('click', (event) => {
    // 点击交给提及的链接，它会在不刷新页面的情况下滚动到帖子。
    event.preventDefault();
    leading.click();
  });
  controls.appendChild(back);
  title.appendChild(controls);

  // 剩下的是原先把提及与文本分开的空格。
  const rest = first.firstChild;
  if (rest && rest.nodeType === Node.TEXT_NODE) rest.textContent = (rest.textContent || '').replace(/^\s+/, '');

  quote.classList.add('LcoyQuote');
  quote.insertBefore(title, first);
}

export function decorateQuotes(body: HTMLElement, post: Post, replyMarker: string | null): void {
  const html = post.contentHtml() || '';

  // 每个内容版本执行一次：onupdate 在每次帖子重绘时都会运行。
  if ((body as any)[DONE] === html) return;
  (body as any)[DONE] = html;

  body.querySelectorAll<HTMLElement>(':scope > blockquote, :scope > * blockquote').forEach((quote) => {
    if (!quote.classList.contains('LcoyQuote')) decorateQuote(quote);
  });

  if (replyMarker) {
    const first = body.firstElementChild;
    const mention =
      first && first.tagName === 'P' ? first.querySelector<HTMLAnchorElement>(`:scope > a.PostMention[data-id="${replyMarker}"]`) : null;

    if (mention && first!.firstElementChild === mention) mention.classList.add('LcoyReplyMarker');
  }
}
