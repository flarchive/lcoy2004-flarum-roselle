import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

export interface GroupFlairAttrs extends ComponentAttrs {
  group: Group;
  size?: 'normal' | 'large';
}

/**
 * Discourse 中的用户组“flair”：一个使用用户组颜色的圆角方块，
 * 内含该组的图标。无图标时显示名称首字母；无颜色时使用主题灰色。
 */
export default class GroupFlair extends Component<GroupFlairAttrs> {
  view(): Mithril.Children {
    const { group, size = 'normal' } = this.attrs;
    const color = group.color();
    const icon = group.icon();

    return (
      <span
        className={`LcoyGroupFlair LcoyGroupFlair--${size}${color ? ' LcoyGroupFlair--colored' : ''}`}
        style={color ? { '--group-color': color } : undefined}
        aria-hidden="true"
      >
        {icon ? <Icon name={icon} /> : <span className="LcoyGroupFlair-initial">{(group.namePlural() || '?').charAt(0).toUpperCase()}</span>}
      </span>
    );
  }
}
