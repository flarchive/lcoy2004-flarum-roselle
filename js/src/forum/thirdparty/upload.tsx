/*
 * fof/upload：Discourse 编辑器中的 "上传中…" 提示（#file-uploading），
 * 带进度条。该扩展不提供百分比（请求只有
 * 一次），所以进度条是不确定的；上传结束或失败时它
 * 会消失。工具栏中的按钮由编辑器负责。
 */
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { thirdParty } from './settings';

export default function installUpload(): void {
  extend(TextEditor.prototype, 'oncreate', function (this: any) {
    this.uploader?.on?.('uploading', (files: FileList | File[]) => {
      this.lcoyUploadCount = files?.length || 1;
    });
  });

  extend(TextEditor.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    if (!thirdParty.uploadProgress() || !this.uploader?.uploading || !vdom || !Array.isArray(vdom.children)) return;

    const count = this.lcoyUploadCount || 1;

    vdom.children.push(
      <div className="LcoyUploadProgress" role="status" aria-live="polite">
        <span className="LcoyUploadProgress-label">{t('thirdparty.upload.uploading', { count })}</span>
        <span className="LcoyUploadProgress-bar" aria-hidden="true">
          <span className="LcoyUploadProgress-fill" />
        </span>
      </div>
    );
  });
}
