/*
 * 用户菜单标签页和底部的图标。Meta（Horizon）用 Lucide 绘制它们——
 * 2px 描边、圆头——而 Flarum 的 Font Awesome 没有相同描边的图标。
 * 基类 `.LcoyIcon`（来自外壳的 Header.less）提供描边；尺寸来自
 * UserMenu.less。
 */
import type Mithril from 'mithril';

import { lucideSvg } from '../icons';

// 标签页名称 → Lucide 图形（icons/glyphs.ts，与 Meta 的 sprite 相同）。
const PATHS: Record<string, string> = {
  bell: 'bell',
  reply: 'reply',
  heart: 'heart',
  mail: 'mail',
  bookmark: 'bookmark',
  // Discourse 的 “discourse-other-tab”：一个 2×2 网格。
  other: 'grid-2x2',
  flag: 'flag',
  user: 'user',
  chevronDown: 'chevron-down',
  check: 'check',
};

export function menuIcon(name: string): Mithril.Children {
  const glyph = PATHS[name];

  return glyph ? lucideSvg(`LcoyIcon LcoyIcon--${name}`, glyph) : null;
}
