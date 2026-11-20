/*
 * Discourse 风格的浏览次数，集中在一处，以便讨论列表、推荐主题、
 * 主题信息和私信显示相同的数字并使用相同的规则：
 *
 * - `formatViews` 是 Discourse 的 `number` 辅助函数（lib/formatter.js）：999、
 *   1.2k、120k、1.0M——使用语言的十进制分隔符；
 * - `viewsTitle` 是 `views_long`（“该主题被浏览了 1,234 次”），
 *   即“浏览”列在鼠标悬停时显示的 title；
 * - `viewsHeat` 使用后台的三个区间（topic_views_heat_low/medium/high，
 *   Discourse 中为 1000/2000/3500），返回 'low' | 'med' | 'high'，
 *   即那边 `heatmap-*` 类的后缀；
 * - `viewsNumber` 构建 `d-number` 的 `<span class="number" title="…">`。
 */
import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import { forumInt, t } from './settings';

export type ViewsHeat = 'low' | 'med' | 'high' | null;

/** Discourse 的默认值，用于论坛尚未序列化区间时。 */
export const VIEWS_HEAT_DEFAULTS = { low: 1000, medium: 2000, high: 3500 };

function locale(): string {
  try {
    return app.translator.getLocale() || 'pt-BR';
  } catch {
    return 'pt-BR';
  }
}

/** Discourse 的 `I18n.toNumber(value, { precision })`：固定小数位，使用语言的分隔符。 */
export function localNumber(value: number, precision = 0): string {
  try {
    return new Intl.NumberFormat(locale(), { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value);
  } catch {
    return value.toFixed(precision);
  }
}

/**
 * Discourse 的 `number()`，逐步说明：四舍五入，超过 999,999 变成
 * 百万并保留一位小数（“1.0M”——零位也保留，与那边一样），超过 99,999
 * 千则不带小数（“120k”，截断），超过 999 千则保留一位小数
 * （“1.2k”）。`maxDisplay` 会截断为“50+”。
 */
export function formatViews(value: number | string | null | undefined, options: { maxDisplay?: number } = {}): string {
  let val = Math.round(parseFloat(String(value)));

  if (Number.isNaN(val)) val = 0;

  const appendPlus = typeof options.maxDisplay === 'number' && options.maxDisplay > 0 && val > 0 && val > options.maxDisplay;

  if (appendPlus) val = options.maxDisplay as number;

  let output: string;

  if (val > 999999) {
    output = t('stats.views.short_millions', { number: localNumber(val / 1000000, 1) });
  } else if (val > 99999) {
    output = t('stats.views.short_thousands', { number: localNumber(Math.floor(val / 1000), 0) });
  } else if (val > 999) {
    output = t('stats.views.short_thousands', { number: localNumber(val / 1000, 1) });
  } else {
    output = val.toString();
  }

  return appendPlus ? `${output}+` : output;
}

/** “该主题被浏览了 1,234 次”（`views_long`）。 */
export function viewsTitle(count: number): string {
  const rounded = Math.round(count) || 0;

  return t('stats.views.views_long', { count: rounded, number: localNumber(rounded) });
}

/** “浏览” / “浏览次数”（`views_lowercase`），主题信息的标签。 */
export function viewsLabel(count: number): string {
  return t('stats.views.views_lowercase', { count: Math.round(count) || 0 });
}

function heatThreshold(attribute: string, fallback: number): number {
  const value = forumInt(attribute, fallback);

  return value > 0 ? value : fallback;
}

/** Discourse Topic 模型的 `viewsHeat`，使用后台的区间。 */
export function viewsHeat(count: number): ViewsHeat {
  const low = heatThreshold('lcoyTopicViewsHeatLow', VIEWS_HEAT_DEFAULTS.low);
  const medium = heatThreshold('lcoyTopicViewsHeatMedium', VIEWS_HEAT_DEFAULTS.medium);
  const high = heatThreshold('lcoyTopicViewsHeatHigh', VIEWS_HEAT_DEFAULTS.high);

  if (count >= high) return 'high';
  if (count >= medium) return 'med';
  if (count >= low) return 'low';

  return null;
}

/**
 * `{{dNumber views numberKey="views_long"}}`：缩写数字放在
 * `<span class="number">` 中，仅当 title 比数字提供更多信息时才添加完整 title
 * （使用 `views_long` 时总是添加）。`noTitle` 用于主题信息，
 * 它旁边已经写了“浏览”。
 */
export function viewsNumber(count: number, options: { noTitle?: boolean; className?: string } = {}): Mithril.Vnode {
  const text = formatViews(count);
  const title = options.noTitle ? undefined : viewsTitle(count);

  return m('span', { className: options.className ? `number ${options.className}` : 'number', title }, text);
}
