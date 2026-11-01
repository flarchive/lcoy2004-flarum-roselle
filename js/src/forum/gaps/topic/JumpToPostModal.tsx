/*
 * Discourse 的“跳转到…”（按键 #）：输入帖子编号。核心没有这个
 * 窗口；时间线只能拖动。（Discourse 的按日期跳转选项不在其中：
 * Flarum 的 API 无法按日期查找帖子。）
 */
import { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

export interface JumpToPostModalAttrs extends IInternalModalAttrs {
  stream: any;
}

export default class JumpToPostModal extends FormModal<JumpToPostModalAttrs> {
  number = Stream('');

  className() {
    return 'LcoyJumpModal Modal--small';
  }

  title() {
    return t('gaps.jump.title');
  }

  content(): Mithril.Children {
    const count = this.attrs.stream?.count?.() || 0;

    return (
      <div className="Modal-body">
        <div className="Form-group LcoyJumpModal-number">
          <label for="lcoy-jump-number">{t('gaps.jump.post_label')}</label>
          <div className="LcoyJumpModal-row">
            <input id="lcoy-jump-number" className="FormControl" type="number" min="1" max={count || undefined} bidi={this.number} placeholder="#" />
            <span className="LcoyJumpModal-of">{t('gaps.jump.of', { count })}</span>
          </div>
        </div>
        <div className="Form-group">
          <Button className="Button Button--primary Button--block" type="submit">
            {t('gaps.jump.submit')}
          </Button>
        </div>
      </div>
    );
  }

  onsubmit(event: SubmitEvent) {
    event.preventDefault();

    const stream = this.attrs.stream;
    const number = parseInt(this.number(), 10);

    this.hide();

    if (number > 0) stream.goToNumber(number);
  }
}
