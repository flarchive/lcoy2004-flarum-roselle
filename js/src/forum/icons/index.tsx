/*
 * 主题的统一图标层：Meta 的界面图标。
 *
 * meta.discourse.org 使用 Lucide（2px 描边、圆角端点）绘制界面，
 * 通过 “Discourse Lucide Icons” 组件；Flarum 使用
 * Font Awesome 实心图标。主题没有在每个界面（以及每个
 * 扩展）中逐个替换图标，而是覆盖核心 `Icon` 组件的 `view`，
 * 按钮、菜单项、通知、扩展的 `icon=` 都会经过它……
 * 当名称在映射中（iconMap.ts）时，输出 Lucide 的 <svg>；
 * 不在映射中（品牌、扩展的罕见图标、管理员为标签和用户组
 * 选择的大部分图标），则继续使用 Font Awesome 的 <i>。
 *
 * <svg> 保留 <i> 的类（`icon`、`Button-icon`、`fas fa-check`……）：
 * 核心、扩展和主题中针对这些类的 CSS（边距、
 * 颜色、`fa-spin`、`fa-fw`）仍然生效。
 */
import type Mithril from 'mithril';
import Icon from 'flarum/common/components/Icon';
import type { IIconAttrs } from 'flarum/common/components/Icon';
import { override } from 'flarum/common/extend';
import classList from 'flarum/common/utils/classList';
import type { IconNode } from 'lucide';

import { forumBool } from '../utils/settings';
import { lucideNameFor } from './iconMap';
import { GLYPHS } from './glyphs';

/** Lucide <svg> 的属性；描边 2 是 “medium”，Meta 组件的默认值。 */
const SVG_ATTRS: Record<string, string> = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

// 同一个图标名称在每次 redraw 中会被绘制数十次（整个
// 讨论列表）；名称解析会经过别名和两个映射，因此
// 按类名缓存结果。
const resolved = new Map<string, string | null>();

function resolve(classes: string): string | null {
  let name = resolved.get(classes);
  if (name === undefined) {
    name = lucideNameFor(classes);
    resolved.set(classes, name);
  }
  return name;
}

function glyph(name: string): IconNode | null {
  return GLYPHS[name] ?? null;
}

function enabled(): boolean {
  return forumBool('lcoyLucideIcons', true);
}

/**
 * 某个 Font Awesome 类的 Lucide 图案，或当它继续使用
 * Font Awesome 时为 `null`（不在映射中，或管理员关闭了该选项）。
 */
export function lucideFor(classes: string): { name: string; node: IconNode } | null {
  if (!classes || !enabled()) return null;
  const name = resolve(classes);
  const node = name ? glyph(name) : null;
  return name && node ? { name, node } : null;
}

/**
 * 直接在 `Icon` 组件之外构建的 Lucide <svg>（外壳和
 * 用户菜单中的固定图标，这些始终是 Lucide）。
 */
export function lucideSvg(className: string, name: string): Mithril.Children {
  const node = GLYPHS[name];

  if (!node) return null;

  return (
    <svg {...SVG_ATTRS} className={className}>
      {/* 每次绘制都复制属性：同一个对象在 redraw 中再次出现时，
          Mithril 会警告（并在下一个 major 版本中抛错）。 */}
      {node.map(([tag, attrs]) => m(tag, { ...attrs }))}
    </svg>
  );
}

function svgClass(classes: string, name: string, extra?: string): string {
  return classList('icon', classes, 'LcoyLucide', `lucide-${name}`, extra);
}

/**
 * 给少数以文本形式构建 HTML 的位置（渲染后帖子内容中的
 * `innerHTML`）：与组件相同的规则，但以字符串形式。
 */
export function iconMarkup(classes: string, extraClass = ''): string {
  const found = lucideFor(classes);
  if (!found) return `<i aria-hidden="true" class="${classList('icon', classes, extraClass)}"></i>`;

  const attrs = Object.entries(SVG_ATTRS)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  const children = found.node
    .map(([tag, childAttrs]) => {
      const list = Object.entries(childAttrs)
        .map(([key, value]) => ` ${key}="${String(value)}"`)
        .join('');
      return `<${tag}${list}/>`;
    })
    .join('');

  return `<svg class="${svgClass(classes, found.name, extraClass)}"${attrs}>${children}</svg>`;
}

export default function installIcons(): void {
  override(Icon.prototype, 'view', function (this: Icon, original: (vnode: Mithril.Vnode<IIconAttrs, Icon>) => Mithril.Children, vnode) {
    const { name, noStyleOverride, ...attrs } = vnode.attrs as IIconAttrs & Record<string, any>;

    // Button 中的 `icon={true}` 只绘制一个空的 <i> 来占位
    // （菜单中未勾选的条目）：没有可替换的内容。
    const found = typeof name === 'string' ? lucideFor(name) : null;
    if (!found) return original(vnode);

    return (
      <svg {...SVG_ATTRS} {...attrs} className={svgClass(name, found.name, attrs.className)}>
        {/* 复制属性：GLYPHS 中的对象在每次 redraw 中都是同一个。 */}
        {found.node.map(([tag, childAttrs]) => m(tag, { ...childAttrs }))}
      </svg>
    );
  });
}
