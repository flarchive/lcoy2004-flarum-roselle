/*
 * Discourse 的时间线就是换了外观的核心 PostStreamScrubber：逻辑（拖动滑块、
 * 点击轨道、未读区域）相同，只是标签不同——上方是创建日期，下方是最后一篇
 * 帖子距今多久，滑块旁边是读者当前所在帖子的日期（“7月16日”），
 * 取代“原帖”/“现在”/“2026年10月”。
 */
import { extend, override } from 'flarum/common/extend';

import app from 'flarum/forum/app';
import type Post from 'flarum/common/models/Post';

import { topicSettings } from './ui';
import { discussionBadges } from '../utils/tags';
import { formatWith, shortAge } from '../utils/dates';
import { t } from '../utils/settings';

const MINUTE = 60 * 1000;
/** 超过此时间后 shortAge 返回日期（"6月8日"），不再加“前”。 */
const AGE_LIMIT = 30 * 24 * 60 * MINUTE;
/** 隐藏帖子场景下两次 DOM 扫描之间的最小间隔。 */
const FALLBACK_EVERY_MS = 120;

/**
 * 缓存某个索引对应项的日期：核心在滚动的每一帧都会调用 updateScrubber，
 * 而在这段时间里 DOM 并没有变化。只有真正的帖子才有 `data-time`；
 * 当索引显示的是骨架时，没有可缓存的内容。
 */
function timeOf(stream: any, index: number): string | undefined {
  const cache: Map<number, string> = stream.lcoyTimes || (stream.lcoyTimes = new Map());
  const cached = cache.get(index);

  if (cached !== undefined) return cached;

  const item = stream.element?.querySelector?.(`.PostStream-item[data-index="${index}"]`) as HTMLElement | null;
  const time = item?.dataset.time;

  if (!time) return undefined;

  cache.set(index, time);

  return time;
}

/**
 * 时间线抽屉用的第一楼开头：contentPlain 在长帖子上开销很大，
 * 而每次加载页面都会重绘抽屉。
 */
function excerptOf(post: Post | null): string {
  if (!post) return '';

  const html = post.contentHtml() || '';
  const cache = (post as any).lcoyExcerpt as { html: string; text: string } | undefined;

  if (cache && cache.html === html) return cache.text;

  const text = (post.contentPlain() || '').trim().slice(0, 400);

  (post as any).lcoyExcerpt = { html, text };

  return text;
}

/**
 * Discourse 的 timelineDate：当前年份显示“7月16日”，往年为“2014年8月”
 * （不带日）。
 */
export function timelineDate(date: Date, now = new Date()): string {
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { month: 'short', year: 'numeric' };

  return formatWith(date, options)
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .trim();
}

export default function installTimeline(): void {
  override('flarum/forum/components/PostStreamScrubber', 'firstPostLabel', function (this: any, original: () => unknown) {
    const created: Date | undefined = this.stream?.discussion?.createdAt();

    if (!topicSettings.timeline() || !created) return original();

    return timelineDate(created);
  });

  override('flarum/forum/components/PostStreamScrubber', 'lastPostLabel', function (this: any, original: () => unknown) {
    const discussion = this.stream?.discussion;
    const last: Date | undefined = discussion?.lastPostedAt() || discussion?.createdAt();

    if (!topicSettings.timeline() || !last) return original();

    const diff = Date.now() - last.getTime();

    // “刚刚”不需要“前”，旧日期直接显示为日期；其余
    // 变成“4 小时前”，与 Discourse 一致。
    if (diff < MINUTE) return shortAge(last);
    if (diff >= AGE_LIMIT) return timelineDate(last);

    return t('topic.timeline.ago', { age: shortAge(last) });
  });

  // 核心在滑块旁写的是最后一个可见帖子的月份（“2026年
  // 10月”）；Discourse 写的是屏幕顶部帖子的日期。在核心之后，
  // 按索引所在的项重新计算。
  extend('flarum/forum/components/PostStream', 'updateScrubber', function (this: any) {
    if (!this.stream) return;

    // 存在隐藏帖子时（“该主题中有 N 篇帖子”过滤器），核心按高度零
    // 相除，索引变成 NaN：只用可见项重新计算。扫描会为每个项强制布局，
    // 所以最多每 120ms 一次；中间帧由最后一个有效索引撑住时间线。
    if (!Number.isFinite(this.stream.index)) {
      const now = performance.now();

      if (!this.lcoyFallbackAt || now - this.lcoyFallbackAt > FALLBACK_EVERY_MS) {
        this.lcoyFallbackAt = now;

        const marginTop = this.getMarginTop?.() || 0;
        const items = this.element?.querySelectorAll?.('.PostStream-item[data-index]') as NodeListOf<HTMLElement> | undefined;
        let first: HTMLElement | null = null;

        if (items) {
          for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();

            if (rect.height > 0 && rect.bottom > marginTop) {
              first = items[i];
              break;
            }
          }
        }

        this.stream.index = first ? Number(first.dataset.index) + 1 : this.stream.count();
        this.lcoyFallbackIndex = this.stream.index;
      } else if (Number.isFinite(this.lcoyFallbackIndex)) {
        this.stream.index = this.lcoyFallbackIndex;
      }

      if (!Number.isFinite(this.stream.visible)) this.stream.visible = 1;
    }

    if (!topicSettings.timeline()) return;

    const index = Math.max(0, Math.floor(this.stream.index) - 1);
    const time = timeOf(this.stream, index);

    if (!time) return;

    const label = timelineDate(new Date(time));

    if (label !== this.stream.description) this.stream.description = label;
  });

  // scrubber 和 stream 各自用自己的 ScrollListener 监听滚动，
  // 而 scrubber 的那个可能在同一帧先运行——于是它绘制的是上一帧的索引，
  // 在跳转时（Home/End、链接）停在旧数字上。延迟一帧可确保 stream 已计算完毕。
  extend('flarum/forum/components/PostStreamScrubber', 'oninit', function (this: any) {
    const listener = this.scrollListener;

    if (!listener || typeof listener.callback !== 'function') return;

    const callback = listener.callback;

    listener.callback = (top: number) => requestAnimationFrame(() => callback(top));
  });

  // 手机上的时间线抽屉（timeline-fullscreen）：左侧是标题、分类和
  // 第一楼开头；右侧是轨道。
  extend('flarum/forum/components/PostStreamScrubber', 'view', function (this: any, vnode: any) {
    if (!topicSettings.timeline() || !vnode || !Array.isArray(vnode.children)) return;

    const menu = vnode.children.find((child: any) => child && child.attrs && /Dropdown-menu/.test(child.attrs.className || ''));
    const discussion = this.stream?.discussion;

    if (!menu || !discussion || !Array.isArray(menu.children)) return;

    // 第一楼是主题的第一个 id：每次绘制都扫描整个 store，
    // 在加载数百篇帖子时开销很大。
    const firstId = discussion.postIds?.()[0];
    const firstPost = (firstId ? app.store.getById<Post>('posts', firstId) : null) || null;
    const author = firstPost ? firstPost.user() : null;
    const excerpt = excerptOf(firstPost);

    menu.children.unshift(
      m('.LcoyTimelineSheet', [
        m('h2.LcoyTimelineSheet-title', discussion.title()),
        m('.LcoyTimelineSheet-badges', discussionBadges(discussion)),
        excerpt ? m('.LcoyTimelineSheet-excerpt', [m('span.LcoyTimelineSheet-user', (author ? author.username() : '') + ':'), ' ', excerpt]) : null,
      ])
    );
  });

  // 手机的浮动按钮用逐渐增长的着色背景展示进度（#topic-progress 的
  // .bg）；比例放在一个变量里。
  extend('flarum/forum/components/PostStreamScrubber', 'updateScrubberValues', function (this: any) {
    const count = this.stream?.count?.() || 0;
    const index = Math.max(1, Math.min(count, Math.round(this.stream?.index || 1)));

    // 每帧都写变量即使值没变也会使样式失效；只写真正
    // 显示出来的比例才值得。
    const progress = count ? String(index / count) : '0';

    if (progress !== this.lcoyProgress) {
      this.lcoyProgress = progress;
      this.element?.style?.setProperty('--lcoy-progress', progress);
    }

    // 目标帖子在顶部时，索引会因一个亚像素停在 19.9998，核心
    //（向下取整）写成“19”；Discourse 显示“20”。
    const raw = this.stream?.index || 1;

    if (raw % 1 > 0.98 && Math.ceil(raw) <= count) {
      const label = String(Math.ceil(raw));
      const indexElement = this.element?.querySelector?.('.Scrubber-index') as HTMLElement | null;

      if (indexElement && indexElement.textContent !== label) indexElement.textContent = label;
    }
  });

  // Discourse 的“1 / 15”标签（.with-topic-progress）位于打开的
  // 编辑器之上：bottom = --composer-height。核心已经为内容的 padding
  // 测量过编辑器；同一测量值写入主题变量。
  extend('flarum/forum/components/Composer', 'updateBodyPadding', function (this: any) {
    const position = this.state?.position;
    const open = position && position !== 'hidden' && app.screen() !== 'phone';
    const height = open ? this.element?.offsetHeight || 0 : 0;

    document.documentElement.style.setProperty('--lcoy-composer-height', `${height}px`);
  });

  // Discourse 的轨道在每次变化（包括滚动）时用 CSS 过渡（.15s ease-out）
  // 动画化高度；核心只在跳转时用 jQuery 动画。去掉 jQuery 后，
  // 由 LESS 的过渡负责。
  override(
    'flarum/forum/components/PostStreamScrubber',
    'updateScrubberValues',
    function (this: any, original: (options?: any) => void, options: any = {}) {
      return original(topicSettings.timeline() ? { ...options, animate: false } : options);
    }
  );
}
