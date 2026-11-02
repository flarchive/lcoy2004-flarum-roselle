/*
 * “你想如何处理你的帖子？”——Discourse 在关闭含文本的 composer
 * 时提出的问题：丢弃、稍后保存或继续编辑。由于服务端有草稿，
 * 关闭不再意味着丢失文本，而这正是核心 confirm() 原先询问的
 * 内容。
 */
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';

import { t } from '../../../utils/settings';

export interface DraftCloseModalAttrs extends IInternalModalAttrs {
  ondiscard: () => void;
  onsave: () => void;
}

export default class DraftCloseModal extends Modal<DraftCloseModalAttrs> {
  className() {
    return 'Modal--small LcoyDraftCloseModal';
  }

  title() {
    return t('composer.drafts.close_title');
  }

  content() {
    return (
      <div className="Modal-body">
        <p className="helpText">{t('composer.drafts.close_text')}</p>
        <div className="LcoyDraftCloseModal-actions">
          <Button
            className="Button Button--danger"
            icon="far fa-trash-can"
            onclick={() => {
              this.hide();
              this.attrs.ondiscard();
            }}
          >
            {t('composer.drafts.discard')}
          </Button>
          <Button
            className="Button Button--primary"
            icon="far fa-floppy-disk"
            onclick={() => {
              this.hide();
              this.attrs.onsave();
            }}
          >
            {t('composer.drafts.save_for_later')}
          </Button>
          <Button className="Button" onclick={() => this.hide()}>
            {t('composer.drafts.keep_editing')}
          </Button>
        </div>
      </div>
    );
  }
}
