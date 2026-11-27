/*
 * Discourse 在帖子内容（“cooked”）进入页面后添加的装饰：
 *
 * - 带“复制”和“全屏”按钮的代码块（codeblock-buttons）；
 * - 悬停时出现 “#” 链接的标题（h1–h6）（a.anchor）；
 * - 带“展开表格”按钮的宽表格；
 * - 毛玻璃剧透，点击后显示（spoiler-alert）。
 *
 * 一切都在已存在的元素内部完成（pre、h2、table…）：帖子通过 m.trust
 * 插入，而 Mithril 按顶层节点数量移除这段 HTML——把块包进新的 <div>
 * 会改变这个数量，在帖子被编辑时留下垃圾。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';

import { gaps } from '../settings';
import { t } from '../../utils/settings';
import { copyText } from '../../utils/clipboard';

const DONE = 'lcoyDecorated';
/** “已复制！”在按钮上停留的时间。 */
const COPIED_MS = 2000;

function iconButton(className: string, icon: string, label: string, onclick: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `Button Button--icon LcoyCodeButton ${className}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<i aria-hidden="true" class="icon ${icon} Button-icon"></i>`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onclick(button);
  });

  return button;
}

function decorateCode(body: HTMLElement): void {
  if (!gaps.codeButtons()) return;

  body.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
    if (pre.dataset[DONE]) return;

    const code = pre.querySelector('code') || pre;

    pre.dataset[DONE] = '1';
    pre.classList.add('LcoyCodeBlock');

    const wrapper = document.createElement('div');
    wrapper.className = 'LcoyCodeBlock-buttons';
    wrapper.setAttribute('contenteditable', 'false');

    wrapper.appendChild(
      iconButton('LcoyCodeButton--copy', 'far fa-copy', t('gaps.code.copy'), (button) => {
        copyText(code.textContent || '').then((ok) => {
          if (!ok) return;

          button.classList.add('LcoyCodeButton--done');
          button.innerHTML = `<i aria-hidden="true" class="icon fas fa-check Button-icon"></i>`;
          button.title = t('gaps.code.copied');

          window.setTimeout(() => {
            button.classList.remove('LcoyCodeButton--done');
            button.innerHTML = `<i aria-hidden="true" class="icon far fa-copy Button-icon"></i>`;
            button.title = t('gaps.code.copy');
          }, COPIED_MS);
        });
      })
    );

    wrapper.appendChild(
      iconButton('LcoyCodeButton--fullscreen', 'fas fa-up-right-and-down-left-from-center', t('gaps.code.fullscreen'), () => {
        const copy = pre.cloneNode(true) as HTMLElement;
        copy.querySelector('.LcoyCodeBlock-buttons')?.remove();

        app.modal.show(() => import('./FullscreenModal'), { title: t('gaps.code.view_code'), html: copy.outerHTML, kind: 'code' });
      })
    );

    pre.insertBefore(wrapper, pre.firstChild);
  });
}

/** 标题的“名称”，与 Discourse 的 markdown-it 一致：小写、连字符、去掉重音。 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function decorateHeadings(body: HTMLElement, postId: string): void {
  if (!gaps.headingAnchors()) return;

  const used = new Set<string>();

  body.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    if (heading.dataset[DONE] || heading.closest('blockquote, .LcoyEmbeddedPost')) return;

    const base = slugify(heading.textContent || '') || 'h';
    let slug = base;

    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    used.add(slug);

    // id 带上帖子：两个标题相同的帖子不会争抢锚点。
    const id = `p-${postId}-${slug}`;

    heading.dataset[DONE] = '1';
    heading.id = id;

    const anchor = document.createElement('a');
    anchor.className = 'LcoyAnchor';
    anchor.href = `#${id}`;
    anchor.title = t('gaps.heading_anchor');
    anchor.setAttribute('aria-label', t('gaps.heading_anchor'));
    anchor.addEventListener('click', (event) => {
      event.preventDefault();

      // 不切换 Mithril 路由（hash 会变成一次导航）：地址加上锚点，
      // 页面滚动到标题。
      history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#${id}`);
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    heading.insertBefore(anchor, heading.firstChild);

    // 通过带锚点的链接进来的人会落在标题处，而不是帖子顶部。
    if (window.location.hash === `#${id}`) window.setTimeout(() => heading.scrollIntoView({ block: 'start' }), 300);
  });
}

function decorateTables(body: HTMLElement): void {
  if (!gaps.tableExpand()) return;

  body.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (table.dataset[DONE]) return;

    table.dataset[DONE] = '1';

    // 只有放不下的表格才加按钮，与 Discourse 一致。
    if (table.scrollWidth <= table.clientWidth + 2) return;

    const caption = document.createElement('caption');
    caption.className = 'LcoyTableExpand';
    caption.setAttribute('contenteditable', 'false');

    const button = iconButton('LcoyTableExpand-button', 'fas fa-up-right-and-down-left-from-center', t('gaps.table.expand'), () => {
      const copy = table.cloneNode(true) as HTMLElement;
      copy.querySelector('.LcoyTableExpand')?.remove();

      app.modal.show(() => import('./FullscreenModal'), { title: t('gaps.table.view_table'), html: copy.outerHTML, kind: 'table' });
    });
    button.insertAdjacentText('beforeend', t('gaps.table.expand'));
    caption.appendChild(button);

    table.insertBefore(caption, table.firstChild);
  });
}

function reveal(spoiler: HTMLElement): void {
  spoiler.classList.remove('LcoySpoiler--blurred');
  spoiler.removeAttribute('aria-label');
  spoiler.removeAttribute('role');
  spoiler.removeAttribute('tabindex');
}

function decorateSpoilers(body: HTMLElement): void {
  if (!gaps.spoilerBlur()) return;

  // Litedown 的行内剧透（||文本||）和块级剧透（>! 文本），后者以
  // 没有摘要的 <details> 形式出现：两者都变成 Discourse 的模糊效果。
  body.querySelectorAll<HTMLElement>('span.spoiler, details.spoiler').forEach((spoiler) => {
    if (spoiler.dataset[DONE]) return;

    spoiler.dataset[DONE] = '1';
    spoiler.classList.add('LcoySpoiler', 'LcoySpoiler--blurred');
    spoiler.setAttribute('role', 'button');
    spoiler.setAttribute('tabindex', '0');
    spoiler.setAttribute('aria-label', t('gaps.spoiler.reveal'));

    if (spoiler.tagName === 'DETAILS') {
      // 作者没有提供 <summary> 时，浏览器会绘制默认的“详细信息”，
      // CSS 触及不到；用一个空（隐藏的）summary 取代它。
      if (!spoiler.querySelector(':scope > summary')) {
        const summary = document.createElement('summary');
        summary.className = 'LcoySpoiler-summary';
        spoiler.insertBefore(summary, spoiler.firstChild);
      }

      (spoiler as HTMLDetailsElement).open = true;
    }

    const onReveal = (event: Event) => {
      if (!spoiler.classList.contains('LcoySpoiler--blurred')) return;

      // 第一次点击只做显示：隐藏的链接不能导航。
      event.preventDefault();
      event.stopPropagation();
      reveal(spoiler);
    };

    spoiler.addEventListener('click', onReveal, true);
    spoiler.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') onReveal(event);
    });
  });
}

/**
 * Discourse 的本地日期（[date=2026-10-20 time=14:00 timezone=…]）：
 * 服务器按作者所在时区下发日期；这里把它转换成读者时区的同一时刻，
 * 带地球图标，title 中保留原始时间。
 */
function zonedToDate(date: string, time: string, zone: string): Date | null {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = (time || '00:00').split(':').map(Number);
  const utc = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0);

  if (!zone) return time ? new Date(year, month - 1, day, hour || 0, minute || 0, second || 0) : new Date(utc);

  try {
    // 该时刻请求时区与 UTC 的差值（含夏令时）。
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(utc));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const asZone = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));

    return new Date(utc - (asZone - utc));
  } catch {
    return null;
  }
}

function decorateLocalDates(body: HTMLElement): void {
  body.querySelectorAll<HTMLElement>('span.lcoy-local-date').forEach((span) => {
    if (span.dataset[DONE]) return;

    span.dataset[DONE] = '1';

    const date = span.dataset.date || '';
    const time = span.dataset.time || '';
    const zone = span.dataset.timezone || '';
    const moment = /^\d{4}-\d{2}-\d{2}$/.test(date) ? zonedToDate(date, time, zone) : null;

    if (!moment || isNaN(moment.getTime())) return;

    const locale = app.translator.getLocale() || undefined;
    const options: Intl.DateTimeFormatOptions = time
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

    span.classList.add('LcoyLocalDate');
    span.title = [span.textContent || '', zone].filter(Boolean).join(': ');
    span.innerHTML = '<i aria-hidden="true" class="icon fas fa-globe"></i> ';
    span.appendChild(document.createTextNode(new Intl.DateTimeFormat(locale, options).format(moment)));
  });
}

export function decorateCooked(body: HTMLElement, postId: string): void {
  decorateLocalDates(body);
  decorateSpoilers(body);
  decorateCode(body);
  decorateHeadings(body, postId);
  decorateTables(body);
}

export default function installCookedDecorators(): void {
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    const body = this.element?.querySelector?.('.Post-body') as HTMLElement | null;
    const post = this.attrs?.post;

    if (!body || !post) return;

    // Mithril 会在每次重绘时调用 onupdate（点赞、展开回复……），但这些
    // 操作不改正文。用正文长度和编辑时间做签名，内容没变就不再重复扫描
    // 这个帖子的 DOM。
    const signature = `${post.id()}:${String(post.attribute('contentHtml') ?? '').length}:${String(post.editedAt?.()?.getTime?.() ?? '')}`;

    if (this.lcoyDecoratedFor === signature) return;
    this.lcoyDecoratedFor = signature;

    decorateCooked(body, String(post.id()));
  });
}
