/*
 * Discourse 的“全屏查看代码”和“展开表格”：同一个大窗口，
 * 内含帖子块的副本。
 *
 * HTML 来自已经绘制好的帖子本身（服务器已做清洗），因此
 * 可以直接用 m.trust 插入，无需再次经过格式化器。
 */
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';

export interface CookedFullscreenModalAttrs extends IInternalModalAttrs {
  title: string;
  html: string;
  kind: 'code' | 'table';
}

export default class CookedFullscreenModal extends Modal<CookedFullscreenModalAttrs> {
  className() {
    return `LcoyFullscreenModal LcoyFullscreenModal--${this.attrs.kind} Modal--large`;
  }

  title() {
    return this.attrs.title;
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        <div className="LcoyFullscreenModal-content Post-body">{m.trust(this.attrs.html)}</div>
      </div>
    );
  }
}
