/*
 * 头像在任意显示尺寸下都清晰。
 *
 * 核心把头像存成 100、200、300px 三个版本，`srcset` 按屏幕密度
 * （1x、2x、3x）挑选，而不是按显示尺寸：资料页 144px、用户卡 128px
 * 的大头像在普通屏上拿到 100px 版本，在 2x 屏上拿到 200px 版本，
 * 都被拉伸得发虚。这里把 `srcset` 改成按宽度描述（100w、200w、
 * 300w），再用 `sizes` 告诉浏览器实际显示多宽，由它结合屏幕密度
 * 选最小的够用版本。
 *
 * 实际宽度要等布局后才知道，所以在 oncreate/onupdate 里测；
 * 头像是 `loading="lazy"`，下载会等布局完成，正好带上 `sizes`。
 */
import { extend, override } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import type Mithril from 'mithril';

/** 核心 1x 版本的宽度（AvatarUploader）。 */
const BASE_WIDTH = 100;

/** 测量前的默认值：列表里最常见的 48px，与改动前取到同一版本。 */
const DEFAULT_SIZES = '48px';

/** "a.webp 1x, a@2x.webp 2x" → "a.webp 100w, a@2x.webp 200w"；非密度描述返回 null。 */
function widthSrcset(srcset: string): string | null {
  const entries = srcset.split(',').map((entry) => entry.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)x$/));

  if (!entries.length || entries.some((entry) => !entry)) return null;

  return entries.map((entry) => `${entry![1]} ${Math.round(Number(entry![2]) * BASE_WIDTH)}w`).join(', ');
}

function fitSizes(element: Element | undefined): void {
  if (!(element instanceof HTMLImageElement) || !/\s\d+w(,|$)/.test(element.srcset)) return;

  const width = Math.round(element.getBoundingClientRect().width);

  if (width > 0 && element.sizes !== `${width}px`) element.sizes = `${width}px`;
}

export default function installAvatarSizes(): void {
  override(Avatar.prototype, 'view', function (this: Avatar, original: (vnode: Mithril.Vnode) => Mithril.Children, vnode: Mithril.Vnode) {
    const result: any = original(vnode);
    const attrs = result?.tag === 'img' ? result.attrs : null;
    const srcset = attrs && (attrs.srcSet || attrs.srcset);
    const converted = typeof srcset === 'string' ? widthSrcset(srcset) : null;

    if (converted) {
      delete attrs.srcSet;
      attrs.srcset = converted;
      attrs.sizes ??= DEFAULT_SIZES;
    }

    return result;
  });

  extend(Avatar.prototype, ['oncreate', 'onupdate'], function (this: Avatar) {
    fitSizes(this.element);
  });
}
