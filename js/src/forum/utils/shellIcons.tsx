/*
 * 外壳中少数由 Discourse 用 Lucide 绘制（2px 描边、圆角端点）
 * 而 Flarum 的 Font Awesome 没有相同描边的图标：
 * 汉堡菜单、搜索放大镜和高级搜索快捷方式。CSS
 * （Header.less 中的 .LcoyIcon）负责颜色和大小。
 */
import type Mithril from 'mithril';

// 图案来自主题的图标层（icons/glyphs.ts）：与 Meta 相同，
// 只有一个来源。
import { lucideSvg } from '../icons';

/** lucide "menu" */
export function menuIcon(): Mithril.Children {
  return lucideSvg('LcoyIcon LcoyIcon--menu', 'menu');
}

/** lucide "search" */
export function searchIcon(): Mithril.Children {
  return lucideSvg('LcoyIcon LcoyIcon--search', 'search');
}

/** lucide "sliders-horizontal" */
export function slidersIcon(): Mithril.Children {
  return lucideSvg('LcoyIcon LcoyIcon--sliders', 'sliders-horizontal');
}
