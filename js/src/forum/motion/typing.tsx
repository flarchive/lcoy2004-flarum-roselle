/*
 * flarum-realtime 的“某某正在输入……”加上 `discourse-presence` 中
 * 波浪跳动的省略号（`.presence-users .wave .dot`，1.8s）：三个
 * 点依次升起，取代脉动的“…”图标。
 */
import { extend } from 'flarum/common/extend';
import type Mithril from 'mithril';

function wave() {
  return (
    <span className="LcoyWave" aria-hidden="true">
      <span className="LcoyWave-dot">.</span>
      <span className="LcoyWave-dot">.</span>
      <span className="LcoyWave-dot">.</span>
    </span>
  );
}

export default function installTyping() {
  // 只在 flarum-realtime 存在时有效；没有它，onLoad 永远不会触发。
  extend('ext:flarum/realtime/forum/components/TypingIndicator' as any, 'view', function (this: unknown, vdom: Mithril.Vnode<any, any>) {
    const className = String(vdom?.attrs?.className || '');

    if (!className.includes('TypingUsersContainer-active')) return;

    const users = (vdom.children as Mithril.Vnode<any, any>[] | undefined)?.find(
      (child) => child && String(child.attrs?.className || '').includes('TypingUsers')
    );

    if (!users || !Array.isArray(users.children)) return;

    // 第一个子节点是图标；文本在其后，省略号在末尾。
    users.children = users.children.slice(1).concat(wave());
  });
}
