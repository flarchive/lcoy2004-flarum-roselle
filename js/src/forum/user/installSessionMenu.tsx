/*
 * Discourse 的会话菜单以当前登录者开头：头像、名字和
 * @用户名，点击进入资料页。Flarum 的菜单直接以“个人资料”开始；
 * 这里给它加上这个头部，其余条目（包括其他扩展的）
 * 保持原样。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import Separator from 'flarum/common/components/Separator';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

export default function installSessionMenu() {
  extend(SessionDropdown.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    if (!user) return;

    const displayName = user.displayName();
    const username = user.username();

    items.add(
      'lcoyIdentity',
      <Link className="LcoySessionIdentity" href={app.route.user(user)}>
        <Avatar user={user} className="LcoySessionIdentity-avatar" />
        <span className="LcoySessionIdentity-names">
          <span className="LcoySessionIdentity-name">{displayName}</span>
          {displayName !== username && <span className="LcoySessionIdentity-username">@{username}</span>}
        </span>
      </Link>,
      200
    );

    items.add('lcoyIdentitySeparator', <Separator />, 150);
  });
}
