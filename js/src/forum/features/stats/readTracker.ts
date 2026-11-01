/*
 * Discourse 的“timings”的简化版：当主题显示在屏幕上且用户确实在场
 * （标签页可见、最近操作过页面）时，统计阅读秒数以及停留足够久的
 * 帖子，并每 30 秒将两者发送到服务端。
 *
 * 服务端对一切持怀疑态度（见 RecordReadTimeController）；此处只需
 * 注意不要把遗忘打开的标签页计入。
 */
import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';

import { forumBool } from '../../utils/settings';
import { sendReadTime } from './api';

const TICK_MS = 1000;

/** 累积的秒数每隔多久发送到服务端。 */
const FLUSH_EVERY_TICKS = 30;

/** 超过 3 分钟未操作页面即视为用户离开（与 Discourse 相同）。 */
const IDLE_AFTER_MS = 3 * 60 * 1000;

/** 帖子在屏幕上停留 2 秒后计为已读。 */
const POST_READ_SECONDS = 2;

/** 服务端每次最多接受 50 个；其余等待下次发送。 */
const MAX_POSTS_PER_FLUSH = 50;

const ACTIVITY_EVENTS = ['scroll', 'wheel', 'keydown', 'mousemove', 'pointerdown', 'touchstart'];

export class ReadTracker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastActivity = Date.now();
  private ticks = 0;
  private seconds = 0;
  private discussionId: string | null = null;

  /** 帖子 id → 在屏秒数，直到计为已读。 */
  private exposure = new Map<string, number>();
  private pending = new Set<string>();
  /** 本次访问页面中已发送的：不重复计数。 */
  private sent = new Set<string>();

  /** 哪些帖子在屏幕上，避免每秒测量一次布局。 */
  private observer: IntersectionObserver | null = null;
  private observed = new WeakSet<Element>();
  private onScreen = new Set<Element>();

  constructor(private readonly currentDiscussionId: () => string | null) {}

  private readonly onActivity = () => {
    this.lastActivity = Date.now();
  };

  private readonly onVisibility = () => {
    // 标签页离开可见状态可能是最后一次发送机会（手机会随即
    // 冻结页面）；fetch 的 keepalive 可保证送达。
    if (document.visibilityState === 'hidden') this.flush();
  };

  start(): void {
    if (this.interval) return;

    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) this.onScreen.add(entry.target);
          else this.onScreen.delete(entry.target);
        });
      });
    }

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, this.onActivity, { passive: true }));
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onVisibility);

    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (!this.interval) return;

    clearInterval(this.interval);
    this.interval = null;

    ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, this.onActivity));
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onVisibility);

    this.observer?.disconnect();
    this.observer = null;
    this.observed = new WeakSet<Element>();
    this.onScreen.clear();

    this.flush();
  }

  private tick(): void {
    const id = this.currentDiscussionId();

    // 从某个主题切换到另一个时 DiscussionPage 会被复用：前一个主题
    // 累积的数据会随其 id 一起发送，然后重新开始。
    if (id !== this.discussionId) {
      this.flush();
      this.discussionId = id;
      this.exposure.clear();
      this.sent.clear();
    }

    if (!id || document.visibilityState !== 'visible' || Date.now() - this.lastActivity > IDLE_AFTER_MS) return;

    this.seconds++;
    this.collectVisiblePosts();

    if (++this.ticks >= FLUSH_EVERY_TICKS) this.flush();
  }

  private collectVisiblePosts(): void {
    const items = document.querySelectorAll<HTMLElement>('.PostStream-item[data-id]');

    // 没有 IntersectionObserver 时，按屏幕位置采样。
    if (!this.observer) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      items.forEach((element) => {
        const rect = element.getBoundingClientRect();

        if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.height === 0) return;

        this.countExposure(element.dataset.id);
      });

      return;
    }

    // observer 会在帖子进入和离开屏幕时通知；此处只登记新项
    // （流会卸载旧项）并统计在屏内容的时长——无需每秒测量布局。
    items.forEach((element) => {
      if (this.observed.has(element)) return;

      this.observed.add(element);
      this.observer!.observe(element);
    });

    this.onScreen.forEach((element) => {
      if (!element.isConnected) {
        this.observer!.unobserve(element);
        this.onScreen.delete(element);
        return;
      }

      this.countExposure((element as HTMLElement).dataset.id);
    });
  }

  private countExposure(postId: string | undefined): void {
    if (!postId || this.sent.has(postId) || this.pending.has(postId)) return;

    const seconds = (this.exposure.get(postId) || 0) + 1;

    if (seconds >= POST_READ_SECONDS) {
      this.exposure.delete(postId);
      this.pending.add(postId);
    } else {
      this.exposure.set(postId, seconds);
    }
  }

  flush(): void {
    this.ticks = 0;

    const discussionId = this.discussionId;

    if (!discussionId || (this.seconds <= 0 && this.pending.size === 0)) {
      this.seconds = 0;
      return;
    }

    const postIds = Array.from(this.pending).slice(0, MAX_POSTS_PER_FLUSH);

    postIds.forEach((id) => {
      this.pending.delete(id);
      this.sent.add(id);
    });

    sendReadTime({ discussionId, seconds: this.seconds, postIds });

    this.seconds = 0;
  }
}

export function activityEnabled(): boolean {
  return !!app.session.user && forumBool('lcoyStatsActivityEnabled', true);
}

const trackers = new WeakMap<DiscussionPage, ReadTracker>();

export default function installReadTracker(): void {
  extend(DiscussionPage.prototype, 'oncreate', function (this: DiscussionPage) {
    if (!activityEnabled()) return;

    const tracker = new ReadTracker(() => this.discussion?.id() ?? null);

    trackers.set(this, tracker);
    tracker.start();
  });

  extend(DiscussionPage.prototype, 'onremove', function (this: DiscussionPage) {
    trackers.get(this)?.stop();
    trackers.delete(this);
  });
}
