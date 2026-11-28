/*
 * 主包使用的用户菜单文本（头部按钮、资料标签页）。菜单本身是
 * 按需加载的 chunk。
 */
import app from 'flarum/forum/app';

/** 菜单的翻译，作为文本（title、aria-label）。 */
export function umText(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`lcoy-roselle.forum.usermenu.${key}`, params, true) as string;
}
