import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

export interface UserTileAttrs extends ComponentAttrs {
  user: User;
  /** 名称下方的一行额外信息（例如最后访问）。 */
  meta?: Mithril.Children;
  size?: 'normal' | 'small';
}

/**
 * 头像、名称、@用户名和“头衔”——Discourse 各列表（“关于”页面的
 * 团队、目录、组成员）中的用户区块。
 *
 * Flarum 没有用户头衔；该位置显示第一个用户组的名称，这也是
 * Discourse 在头衔来自用户组时的显示方式。
 */
export default class UserTile extends Component<UserTileAttrs> {
  view(): Mithril.Children {
    const { user, meta, size = 'normal' } = this.attrs;
    const displayName = user.displayName();
    const username = user.username();
    const group = ((user.groups() || []) as (Group | undefined)[]).find((g): g is Group => !!g);
    const url = app.route.user(user);

    return (
      <div className={`LcoyUserTile LcoyUserTile--${size}`}>
        <Link href={url} className="LcoyUserTile-avatar" tabindex="-1" aria-hidden="true">
          <Avatar user={user} />
        </Link>
        <div className="LcoyUserTile-info">
          {/* Discourse 的 name-line：用户名加粗，名称显示在旁边。 */}
          <Link href={url} className="LcoyUserTile-name">
            <span className="LcoyUserTile-username">{username}</span>
            {displayName !== username && <span className="LcoyUserTile-displayName">{displayName}</span>}
          </Link>
          {group && <span className="LcoyUserTile-title">{group.nameSingular()}</span>}
          {meta && <span className="LcoyUserTile-meta">{meta}</span>}
        </div>
      </div>
    );
  }
}
