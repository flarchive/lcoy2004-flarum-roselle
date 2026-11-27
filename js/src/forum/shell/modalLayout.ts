import { extend } from 'flarum/common/extend';
import type Mithril from 'mithril';

/**
 * 长表单弹窗（less/forum/ModalLayout.less）：CSS 按主题
 * 把字段分配到各列，但核心的条目没有可用于区分
 * 字段的类名（用户名和邮箱都是相同的 `.Form-group`）。
 * 这里在绘制时给 ItemList 的每个条目加上 `data-item="<键>"`；
 * 逻辑和保存都不变，没有规则的扩展字段只会
 * 落到网格中下一个空位。
 */
const MODALS = ['flarum/common/components/EditUserModal'];

function tagItems(children: unknown, depth = 0): void {
  if (!Array.isArray(children) || depth > 4) return;

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;

    const vnode = child as Mithril.Vnode<Record<string, unknown>> & { itemName?: string };

    // `toArray()` 会把 `itemName` 放到条目上；只有 HTML 元素会获得
    // 该属性（放在组件上会进入其 attrs，而不是 DOM）。
    if (typeof vnode.itemName === 'string' && typeof vnode.tag === 'string' && vnode.attrs && typeof vnode.attrs === 'object') {
      vnode.attrs['data-item'] = vnode.itemName;
      continue;
    }

    tagItems(vnode.children, depth + 1);
  }
}

export default function installModalLayout(): void {
  // 按需加载的模块：按名称扩展。
  for (const module of MODALS) {
    extend(module as any, 'content', function (vdom: Mithril.Children) {
      tagItems([vdom]);
    });
  }
}
