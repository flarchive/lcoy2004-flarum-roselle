/*
 * Discourse 短格式的日期：“刚刚”、“5 分钟”、“4 小时”、“3 天”、“6月8日”、
 * “2025年9月”。使用论坛当前语言的 Intl，而不是 dayjs：核心只
 * 加载它自己需要的插件，而缩写格式不在
 * 其中。
 */
import app from 'flarum/forum/app';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 年龄以天显示直到多少天，之后变成日期。 */
const DAYS_BEFORE_DATE = 30;

function activeLocale(): string {
  return (app.data as any).locale || document.documentElement.lang || 'en';
}

/**
 * 每种语言+格式一个 Intl.DateTimeFormat：每次调用都新建很
 * 昂贵，而这些日期会在每个绘制的帖子和滚动的每一帧中
 * 格式化（时间线的标签）。
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);

  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(locale, options);
    } catch {
      // 浏览器不认识的语言代码：使用系统格式。
      formatter = new Intl.DateTimeFormat(undefined, options);
    }

    formatters.set(key, formatter);
  }

  return formatter;
}

export function formatWith(date: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return formatterFor(activeLocale(), options).format(date);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

/** Intl 会在 pt-BR 的缩写月份中加上句点和“de”（“8 de jun.”）；Discourse 不会。 */
function compact(text: string): string {
  return text
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .trim();
}

export function shortAge(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '';

  const diff = Math.max(0, now.getTime() - date.getTime());

  if (diff < MINUTE) return app.translator.trans('lcoy-roselle.forum.age.now', {}, true) as string;
  if (diff < HOUR) return app.translator.trans('lcoy-roselle.forum.age.minutes', { count: Math.floor(diff / MINUTE) }, true) as string;
  if (diff < DAY) return app.translator.trans('lcoy-roselle.forum.age.hours', { count: Math.floor(diff / HOUR) }, true) as string;
  if (diff < DAYS_BEFORE_DATE * DAY) return app.translator.trans('lcoy-roselle.forum.age.days', { count: Math.floor(diff / DAY) }, true) as string;

  if (date.getFullYear() === now.getFullYear()) return compact(formatWith(date, { day: 'numeric', month: 'short' }));

  return compact(formatWith(date, { month: 'short', year: 'numeric' }));
}

/**
 * Discourse 的带“之前”的“中等”日期（`relativeAgeMedium`、`leaveAgo`）：
 * “5 分钟前”、“2 小时前”、“5 天前”，从 6 天起显示
 * 日期（“10月11日”）。用于个人主页的活动条目。
 */
export function mediumAge(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '';

  const diff = Math.max(0, now.getTime() - date.getTime());
  const tr = (key: string, count?: number) => app.translator.trans(`lcoy-roselle.forum.user.age_ago.${key}`, { count }, true) as string;

  if (diff < MINUTE) return tr('now');
  if (diff < HOUR) return tr('minutes', Math.floor(diff / MINUTE));
  if (diff < DAY) return tr('hours', Math.floor(diff / HOUR));
  if (diff < 6 * DAY) return tr('days', Math.floor(diff / DAY));

  return shortDate(date, now);
}

/** 短时间显示的 title 使用的完整日期：“2026年10月17日 14:05”。 */
export function fullDate(date: Date | null | undefined): string {
  if (!date) return '';

  return formatWith(date, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** “6月8日”或“2024年6月8日”——主题信息和时间线的日期。 */
export function shortDate(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '';

  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };

  return compact(formatWith(date, options));
}

/** 最近几天的 `YYYY-MM-DD..YYYY-MM-DD` 区间，采用核心 `created` 筛选器的格式。 */
export function lastDaysRange(days: number, now = new Date()): string {
  const toIsoDay = (date: Date) =>
    [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

  // 结束是明天：筛选器与最后一天的午夜比较，若以今天结束，
  // 今天创建的所有内容都会被排除在外。
  const from = new Date(now.getTime() - days * DAY);
  const to = new Date(now.getTime() + DAY);

  return `${toIsoDay(from)}..${toIsoDay(to)}`;
}
