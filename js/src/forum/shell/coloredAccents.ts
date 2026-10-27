/*
 * 按标签着色（如同 avocado 主题）：在标签页或
 * 讨论中，主题的强调色变成主标签的颜色
 * ——主按钮、链接、当前标签页、聚焦环、淡色背景，所有
 * 从 `--lcoy-accent` 派生的内容。
 *
 * 由于主题的整个调色板都来自一个变量，只需在
 * `<html>` 上替换它：派生令牌（`oklch(from var(--lcoy-accent) …)`）会
 * 自行重新计算。在标签页/讨论之外，该变量被移除，恢复论坛的
 * 主色。
 */
import app from 'flarum/forum/app';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Discussion from 'flarum/common/models/Discussion';

import { forumBool } from '../utils/settings';
import { currentTag, discussionTags, type LcoyTag } from '../utils/tags';

let applied: string | null = null;

/** 对某个标签生效的颜色：它自己的颜色，或在子标签没有颜色时使用父标签的。 */
function tagColor(tag: LcoyTag | null | undefined): string | null {
  if (!tag) return null;

  const own = tag.color();
  if (own) return own;

  const parent = tag.isChild() ? (tag.parent() as LcoyTag | null) : null;

  return parent?.color() || null;
}

/** 讨论的主标签：最具体的子标签，或第一个主标签。 */
function primaryTagOf(discussion: Discussion): LcoyTag | null {
  const primaries = discussionTags(discussion).filter((tag) => tag.position() !== null);

  return primaries.find((tag) => tag.isChild()) ?? primaries[0] ?? null;
}

function activeColor(): string | null {
  if (!forumBool('lcoyColoredAccents', true)) return null;

  if (app.current.matches(DiscussionPage)) {
    const discussion = app.current.get('discussion') as Discussion | null;

    return discussion ? tagColor(primaryTagOf(discussion)) : applied;
  }

  if (app.current.matches(IndexPage)) return tagColor(currentTag());

  return null;
}

/**
 * 颜色上的文字：颜色较浅时使用深色（黄色、青柠色、浅蓝色……），
 * 以便主按钮和页头徽标保持可读。使用 WCAG 的
 * 相对亮度：YIQ 的阈值会放过浅色。
 */
function textOn(hex: string): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const channel = (v: number) => {
    const s = v / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return luminance > 0.179 ? '#1a1a1a' : '#ffffff';
}

/** 论坛主色上的文字颜色（与主按钮使用相同的计算）。 */
function forumTextColor(): string | null {
  const color = app.forum?.attribute<string>('themePrimaryColor');

  return color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? textOn(color) : null;
}

export function updateColoredAccents(): void {
  const color = activeColor();

  if (color === applied) return;

  applied = color;
  const root = document.documentElement;

  if (color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    root.style.setProperty('--lcoy-accent', color);
    root.style.setProperty('--primary-color', color);
    root.style.setProperty('--lcoy-accent-text', textOn(color));
    root.classList.add('Lcoy--colored');
  } else {
    root.style.removeProperty('--lcoy-accent');
    root.style.removeProperty('--primary-color');
    root.classList.remove('Lcoy--colored');

    // 没有标签时，使用论坛主色上的文字：浅色主色需要
    // 深色文字——包括彩色页头徽标。
    const fallback = forumTextColor();

    if (fallback) root.style.setProperty('--lcoy-accent-text', fallback);
    else root.style.removeProperty('--lcoy-accent-text');
  }
}

/**
 * 单独挂载一个组件，只为在每次 redraw 时被调用：页面
 * 切换、讨论加载完成以及标签变化都会经过一次 redraw。
 */
let watched = false;

export function watchColoredAccents(): void {
  // 保持幂等：重复调用时不再创建第二个隐藏插槽和 redraw 回调。
  if (watched) return;
  watched = true;

  const slot = document.createElement('div');
  slot.hidden = true;
  document.body.appendChild(slot);

  m.mount(slot, {
    view: () => null,
    oncreate: updateColoredAccents,
    onupdate: updateColoredAccents,
  });
}
