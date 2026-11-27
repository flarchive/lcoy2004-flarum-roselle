/*
 * 放在独立 chunk 中的组件（按需 import()）：代码只在
 * 组件首次出现时下载，而不是拖累首次加载的 forum.js。
 * chunk 只会请求一次；后续实例会立即绘制。
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';

type Loaded = Mithril.ComponentTypes<any, any>;

/**
 * 一个在 chunk 到达前绘制 `placeholder`、之后使用相同 attrs 和子节点
 * 绘制真实组件的组件。如果下载失败，下次出现时
 * 会重试。
 */
export function lazyComponent<Attrs extends ComponentAttrs = any>(
  load: () => Promise<Loaded>,
  placeholder: () => Mithril.Children = () => null
): typeof Component<Attrs> {
  let loaded: Loaded | null = null;
  let pending: Promise<void> | null = null;

  const fetch = () => {
    pending ||= load().then(
      (component) => {
        loaded = component;
        m.redraw();
      },
      () => {
        pending = null;
      }
    );
  };

  return class LazyComponent extends Component<Attrs> {
    oninit(vnode: Mithril.Vnode<Attrs, Component<Attrs>>) {
      super.oninit(vnode);

      if (!loaded) fetch();
    }

    view(vnode: Mithril.Vnode<Attrs, Component<Attrs>>) {
      const Comp = loaded as any;

      return Comp ? <Comp {...vnode.attrs}>{vnode.children}</Comp> : placeholder();
    }
  };
}
