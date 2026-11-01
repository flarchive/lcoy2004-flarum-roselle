/*
 * /login 和 /signup：Discourse 风格的全屏登录与注册页面
 * （`.login-fullpage`/`.signup-fullpage`）——论坛 logo、大标题、
 * 表单、“忘记密码”、社交登录按钮（fof/oauth）以及
 * 跳转到另一页面的链接。
 *
 * 不重写 POST：表单本身就是核心的 LogInModal/SignUpModal，
 * 由子类绘制在页面内。这样就沿用了核心的校验、扩展在弹窗中
 * 添加的字段（fof/terms）以及主题对它们已有的处理（浮动标签、标题）。
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

export type AuthMode = 'login' | 'signup' | 'forgot';

const MODULES: Record<AuthMode, string> = {
  login: 'flarum/forum/components/LogInModal',
  signup: 'flarum/forum/components/SignUpModal',
  forgot: 'flarum/forum/components/ForgotPasswordModal',
};

const RETURN_KEY = 'lcoy.authReturn';

/** 在页面之间携带的值（登录页输入的邮箱会带到注册页），不经过 URL。 */
let carried: Record<string, unknown> = {};

/** 记录用户来源页面：登录后返回该页面。 */
export function rememberReturn(): void {
  const route = m.route.get();

  if (!route || /^\/(login|signup|forgot-password|reset)\b/.test(route)) return;

  try {
    sessionStorage.setItem(RETURN_KEY, route);
  } catch {
    // 没有存储时，用户将返回首页。
  }
}

function takeReturn(): string {
  try {
    const route = sessionStorage.getItem(RETURN_KEY);

    sessionStorage.removeItem(RETURN_KEY);

    // 仅限论坛自身的路径。
    if (route && route.startsWith('/') && !route.startsWith('//')) return route;
  } catch {
    // 同上。
  }

  return app.route('index');
}

export function goToAuth(mode: AuthMode, attrs: Record<string, unknown> = {}): void {
  carried = attrs;
  m.route.set(app.route(`lcoy.${mode}`));
}

/** 每个弹窗的子类，在模块加载时创建一次。 */
const classes: Partial<Record<AuthMode, any>> = {};

function pageClass(mode: AuthMode, Base: any): any {
  if (classes[mode]) return classes[mode];

  classes[mode] = class extends Base {
    // 页面上无需关闭：✕ 隐藏，Esc 也不起作用。
    static isDismissibleViaCloseButton = false;
    static isDismissibleViaEscKey = false;
    static isDismissibleViaBackdropClick = false;

    className() {
      return `${super.className()} LcoyAuthForm`;
    }

    hide() {
      m.route.set(app.route('index'));
    }

    // 使用“重置密码”而非“密码重置”：这是页面标题。
    title() {
      return mode === 'forgot' ? t('auth.forgot_heading') : super.title();
    }

    forgotPassword() {
      const email = String(this.identification?.() || '');

      goToAuth('forgot', email.includes('@') ? { email } : {});
    }

    // 两个页面之间是页面级导航，而非弹窗导航。
    signUp() {
      const identification = String(this.identification?.() || '');

      goToAuth('signup', identification ? { [identification.includes('@') ? 'email' : 'username']: identification } : {});
    }

    logIn() {
      const identification = String(this.email?.() || this.username?.() || '');

      goToAuth('login', identification ? { identification } : {});
    }
  };

  return classes[mode];
}

/** “返回登录”，位于密码相关页面卡片的底部。 */
export function backToLogin(): Mithril.Children {
  return (
    <p className="LcoyAuthPage-back">
      <a
        href={app.route('lcoy.login')}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          goToAuth('login');
        }}
      >
        {t('auth.back_to_login')}
      </a>
    </p>
  );
}

/** 弹窗所期望的 ModalManager，但不含任何弹窗：立即打开且不做关闭动画。 */
const embeddedState = { modal: {}, close() {} };

export default class AuthPage extends Page<IPageAttrs> {
  protected bodyClass = 'Lcoy--authPage';
  form: any = null;
  formAttrs: Record<string, unknown> = {};

  mode(): AuthMode {
    const name = this.attrs.routeName;

    return name === 'lcoy.signup' ? 'signup' : name === 'lcoy.forgot' ? 'forgot' : 'login';
  }

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    // 已登录（包括刚登录后页面刷新的情况）：
    // 返回之前所在的位置。
    if (app.session.user) {
      m.route.set(takeReturn(), undefined, { replace: true });
      return;
    }

    const mode = this.mode();

    if (mode === 'signup' && !app.forum.attribute<boolean>('allowSignUp')) {
      m.route.set(app.route('lcoy.login'), undefined, { replace: true });
      return;
    }

    this.formAttrs = carried;
    carried = {};

    app.setTitle(t(`auth.${mode}_page_title`));
    app.setTitleCount(0);

    (flarum as any).reg.asyncModuleImport(MODULES[mode]).then((module: any) => {
      this.form = pageClass(mode, module.default ?? module);
      m.redraw();
    });
  }

  view() {
    const Form = this.form;
    const mode = this.mode();

    return (
      <div className={`LcoyAuthPage LcoyAuthPage--${mode}`}>
        <div className="LcoyAuthPage-inner">
          {this.logo()}
          {Form ? (
            <Form state={embeddedState} animateShow={(ready: () => void) => ready()} animateHide={() => {}} {...this.formAttrs} />
          ) : (
            <LoadingIndicator display="block" />
          )}
          {mode === 'forgot' ? backToLogin() : null}
        </div>
      </div>
    );
  }

  logo(): Mithril.Children {
    return authLogo();
  }
}

/** 卡片上方的论坛 logo（暗色主题下为暗色版本）。 */
export function authLogo(): Mithril.Children {
  const title = app.forum.attribute<string>('title');
  const logo = app.forum.attribute<string | null>('logoUrl');
  const dark = app.forum.attribute<string | null>('logoDarkModeUrl');

  return (
    <a className="LcoyAuthPage-logo" href={app.route('index')} aria-label={title}>
      {logo ? (
        [
          <img className={`LcoyAuthPage-logoImage${dark ? ' LcoyAuthPage-logoImage--light' : ''}`} src={logo} alt="" />,
          dark ? <img className="LcoyAuthPage-logoImage LcoyAuthPage-logoImage--dark" src={dark} alt="" /> : null,
        ]
      ) : (
        <span className="LcoyAuthPage-logoText">{title}</span>
      )}
    </a>
  );
}
