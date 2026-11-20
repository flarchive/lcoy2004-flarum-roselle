/*
 * /reset/{token}：“重置密码”页面，外观与登录页面一致（logo、
 * 卡片、标题、带浮动标签的字段），替代核心的简陋页面。
 * 服务端（src/Auth/ResetPasswordContent）按核心的方式校验 token，
 * 并下发 token 及上次尝试的错误；表单提交到核心的 POST /reset
 * （SavePasswordController），由它更换密码、登录并跳回首页——
 * 若出错则带着错误信息返回本页。
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { authLogo, backToLogin } from './AuthPage';

interface ResetPayload {
  token: string;
  errors: string[];
}

export default class ResetPasswordPage extends Page<IPageAttrs> {
  protected bodyClass = 'Lcoy--authPage';
  loading = false;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    app.setTitle(t('auth.reset_heading'));
    app.setTitleCount(0);
  }

  payload(): ResetPayload | null {
    const data = (app.data as any).lcoyReset as ResetPayload | undefined;

    // 只认可当前 URL 中的 token（payload 属于首次加载）。
    return data && data.token === m.route.param('token') ? data : null;
  }

  view() {
    const data = this.payload();

    return (
      <div className="LcoyAuthPage LcoyAuthPage--reset">
        <div className="LcoyAuthPage-inner">
          {authLogo()}
          <div className="Modal modal-dialog LcoyAuthForm LcoyResetForm">
            <div className="Modal-content">{data ? this.form(data) : this.unavailable()}</div>
          </div>
          {backToLogin()}
        </div>
      </div>
    );
  }

  form(data: ResetPayload): Mithril.Children {
    return (
      <form method="POST" action={`${app.forum.attribute<string>('baseUrl')}/reset`} onsubmit={() => (this.loading = true)}>
        <div className="Modal-header">
          <h3 className="App-titleControl App-titleControl--text">{t('auth.reset_heading')}</h3>
        </div>
        {data.errors.length ? (
          <div className="Modal-alert">
            <div className="Alert Alert--error" role="alert">
              <span className="Alert-body">
                {data.errors.map((error) => (
                  <p>{error}</p>
                ))}
              </span>
            </div>
          </div>
        ) : null}
        <div className="Modal-body">
          <div className="Form Form--centered">
            <input type="hidden" name="csrfToken" value={app.session.csrfToken} />
            <input type="hidden" name="passwordToken" value={data.token} />
            <p className="helpText">{t('auth.reset_help')}</p>
            {this.field('password', t('auth.reset_new_password'), true)}
            {this.field('password_confirmation', t('auth.reset_confirm_password'), false)}
            <div className="Form-group">
              <Button className="Button Button--primary Button--block" type="submit" loading={this.loading}>
                {t('auth.reset_submit')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  field(name: string, label: string, focus: boolean): Mithril.Children {
    return (
      <div className="Form-group LcoyFloat">
        <input
          className="FormControl"
          type="password"
          name={name}
          autocomplete="new-password"
          placeholder=" "
          aria-label={label}
          required
          minlength={8}
          oncreate={focus ? (vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus() : undefined}
        />
        <label className="LcoyFloat-label" aria-hidden="true">
          {label}
        </label>
      </div>
    );
  }

  /** 在论坛内部导航到达此处（无服务端 payload）：刷新页面。 */
  unavailable(): Mithril.Children {
    return (
      <div className="Modal-body">
        <p className="helpText">
          <a href={window.location.href} onclick={() => window.location.reload()}>
            {t('auth.reset_heading')}
          </a>
        </p>
      </div>
    );
  }
}
