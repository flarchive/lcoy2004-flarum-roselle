/*
 * 搜索菜单面板的 chunk（SearchPanel + 搜索引擎）。页头字段
 * 位于主包中；面板会在启动空闲时、字段悬停/触摸/聚焦时，
 * 或面板打开时下载——以先发生者为准。
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';

import { once } from '../utils/chunkGate';
import type SearchMenu from './SearchMenu';

type Panel = typeof import('./SearchPanel');

let loaded: Panel | null = null;

const load = once(() =>
  import('./SearchPanel').then((panel) => {
    loaded = panel;

    return panel;
  })
);

let idleQueued = false;

/** `idle`：等待浏览器空闲（不在首次绘制期间）；否则立即执行。 */
export function preloadSearchPanel(opts?: { idle?: boolean } | Event): void {
  if (loaded) return;

  if (opts && !(opts instanceof Event) && opts.idle) {
    if (idleQueued) return;
    idleQueued = true;

    const run = () => load().catch(() => {});
    const idle = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;

    if (idle) idle(run, { timeout: 4000 });
    else window.setTimeout(run, 2000);

    return;
  }

  load().catch(() => {});
}

/** chunk 已到达时立即运行（不丢失事件的重绘）；否则到达时运行。 */
export function withSearchPanel(run: (panel: Panel) => void): void {
  if (loaded) {
    run(loaded);
    return;
  }

  load()
    .then((panel) => {
      run(panel);
      m.redraw();
    })
    .catch(() => {});
}

export interface SearchPanelSlotAttrs extends ComponentAttrs {
  menu: SearchMenu;
}

/** 面板，如果 chunk 已到达；否则在到达前什么也不显示（通常已经到达）。 */
export class SearchPanelSlot extends Component<SearchPanelSlotAttrs> {
  oninit(vnode: Mithril.Vnode<SearchPanelSlotAttrs, this>) {
    super.oninit(vnode);

    if (!loaded)
      load().then(
        () => m.redraw(),
        () => {}
      );
  }

  view(): Mithril.Children {
    const Panel = loaded?.default;

    return Panel ? <Panel menu={this.attrs.menu} /> : null;
  }
}
