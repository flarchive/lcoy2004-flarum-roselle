/*
 * 登录、注册和忘记密码，外观与 meta.discourse.org 的登录页一致：
 * 大标题（"欢迎回来"、"创建你的
 * 账号"）、带浮动标签的字段（Discourse 的 `.input-group`：
 * 标签位于字段内部，聚焦或填写时上移到边框处），以及
 * 密码正下方的 "忘记密码"。
 *
 * 其余弹窗（`.d-modal`）只由 CSS 负责（less/forum/Components.less）。
 *
 * 三个弹窗都位于按需加载的 chunk 中：按名称扩展。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

/**
 * 把 `key` 字段的 `.Form-group` 变成浮动标签组：占位文本
 * （或核心放在上方的 `<label>`）变成字段之后的标签，
 * 占位符设置为 " "，以便 CSS 通过
 * `:placeholder-shown` 判断是否已有文本。
 */
function floatLabel(items: ItemList<Mithril.Children>, key: string): void {
  if (!items.has(key)) return;

  const group: any = items.get(key);
  const children: any[] = Array.isArray(group?.children) ? group.children : [];
  const inputIndex = children.findIndex((child) => child?.tag === 'input');

  if (inputIndex < 0) return;

  const input = children[inputIndex];
  const labelIndex = children.findIndex((child) => child?.tag === 'label');
  const text = input.attrs.placeholder || input.attrs['aria-label'] || '';

  if (!text) return;

  if (labelIndex >= 0) children.splice(labelIndex, 1);

  input.attrs.placeholder = ' ';
  group.attrs.className = `${group.attrs.className || ''} LcoyFloat`;
  // 标签不接收点击：触摸会落到它下方的字段上。
  children.push(
    <label className="LcoyFloat-label" aria-hidden="true">
      {text}
    </label>
  );
}

export default function installModals() {
  const LOGIN = 'flarum/forum/components/LogInModal';
  const SIGNUP = 'flarum/forum/components/SignUpModal';
  const FORGOT = 'flarum/forum/components/ForgotPasswordModal';

  override(LOGIN as any, 'title', () => t('modals.login_title'));
  override(SIGNUP as any, 'title', () => t('modals.signup_title'));

  extend(LOGIN as any, 'fields', function (this: any, items: ItemList<Mithril.Children>) {
    // "邮箱/用户名"，Discourse 的标签。
    const identification: any = items.has('identification') ? items.get('identification') : null;
    const input = (Array.isArray(identification?.children) ? identification.children : []).find((child: any) => child?.tag === 'input');

    if (input) input.attrs.placeholder = input.attrs['aria-label'] = t('modals.identification');

    floatLabel(items, 'identification');
    floatLabel(items, 'password');

    // "忘记密码" 位于密码下方，与 Discourse 相同（核心页脚的
    // 链接会被 CSS 隐藏）。
    items.add(
      'lcoyForgot',
      <div className="Form-group LcoyLogin-forgot">
        <Button className="Button Button--link Button--text" type="button" onclick={() => this.forgotPassword()}>
          {t('modals.forgot_password')}
        </Button>
      </div>,
      15
    );
  });

  // "还没有账号？"，其下是 "注册"（核心把两者合并成
  // 一句话，使用 "注册"）。
  override(LOGIN as any, 'footer', function (this: any, original: () => Mithril.Children) {
    if (!app.forum.attribute<boolean>('allowSignUp')) return original();

    return (
      <p className="LogInModal-signUp">
        {t('modals.no_account')}{' '}
        <Button className="Button Button--text Button--link" onclick={() => this.signUp()}>
          {t('modals.sign_up')}
        </Button>
      </p>
    );
  });

  extend(SIGNUP as any, 'fields', function (items: ItemList<Mithril.Children>) {
    ['username', 'email', 'password'].forEach((key) => floatLabel(items, key));
  });

  // "重置密码" 是 Discourse 的普通弹窗（不是登录
  // 页面）：页眉中的标题、加粗的说明文本、带占位文本的字段，
  // 以及页脚的 "重置密码"，在有邮箱之前处于禁用状态。
  override(FORGOT as any, 'title', () => t('modals.forgot_title'));

  // 举报（Discourse 的 `flag-modal`）："感谢你帮助维护
  // 我们文明的社区！"、Discourse 的原因名称（"偏离
  // 主题"、"其他原因"）以及页脚的 "举报帖子"。
  const FLAG = 'ext:flarum/flags/forum/components/FlagPostModal';
  const FLAG_LABELS: Record<string, string> = { 'off-topic': 'modals.flag_off_topic', other: 'modals.flag_other' };

  override(FLAG as any, 'title', () => t('modals.flag_title'));

  extend(FLAG as any, 'flagReasons', function (items: ItemList<Mithril.Children>) {
    Object.entries(FLAG_LABELS).forEach(([key, label]) => {
      const item: any = items.has(key) ? items.get(key) : null;
      const children: any[] = Array.isArray(item?.children) ? item.children : [];
      const index = children.findIndex((child: any) => child?.tag === 'strong');

      // 元素的子节点已经是规范化的 vnode：替换整个
      // vnode，而不是直接在里面放原始文本。
      if (index >= 0) children[index] = <strong>{t(label)}</strong>;
    });
  });

  extend(FLAG as any, 'content', function (this: any, vnode: any) {
    if (this.success) return;

    // 提交按钮是表单中最后一个 `Button--primary`。
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) return node.map(walk).find(Boolean) || null;
      if (node.attrs?.type === 'submit') return node;

      return walk(node.children);
    };
    const submit = walk(vnode);

    if (submit) submit.children = [t('modals.flag_submit')];
  });

  extend(FORGOT as any, 'fields', function (this: any, items: ItemList<Mithril.Children>) {
    if (!items.has('submit')) return;

    const group: any = items.get('submit');
    const button = (Array.isArray(group?.children) ? group.children : [group?.children]).find((child: any) => child?.attrs);

    if (!button) return;

    button.attrs.className = 'Button Button--primary';
    button.attrs.disabled = !String(this.email() || '').trim();
    button.children = [t('modals.forgot_submit')];
  });
}
