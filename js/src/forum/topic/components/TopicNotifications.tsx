/*
 * Discourse 风格的主题通知控件：一个带当前级别铃铛的按钮，以及一个
 * 每个级别都有标题和描述的菜单。
 *
 * 级别沿用 flarum/subscriptions 的三个（关注、常规、忽略），名称采用 Discourse 的：
 * 关注、常规和静音。主题没有使用扩展的 SubscriptionMenu，因为它的按钮是
 * 分离式的（一次点击关注 + 箭头），而在 Discourse 中点击总是打开菜单。
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import DetailedDropdownItem from 'flarum/common/components/DetailedDropdownItem';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';

import { t } from '../../utils/settings';

export type SubscriptionLevel = 'follow' | 'ignore' | null;

interface Level {
  value: SubscriptionLevel;
  key: 'watching' | 'normal' | 'muted';
  icon: string;
}

export const LEVELS: Level[] = [
  { value: 'follow', key: 'watching', icon: 'fas fa-bell' },
  { value: null, key: 'normal', icon: 'far fa-bell' },
  { value: 'ignore', key: 'muted', icon: 'fas fa-bell-slash' },
];

export function currentLevel(discussion: Discussion): Level {
  const value = ((discussion as any).subscription?.() ?? null) as SubscriptionLevel;

  return LEVELS.find((level) => level.value === value) || LEVELS[1];
}

export interface TopicNotificationsAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** 只有铃铛，圆形——时间线中的版本。 */
  compact?: boolean;
}

export default class TopicNotifications extends Component<TopicNotificationsAttrs> {
  view() {
    const discussion = this.attrs.discussion;
    const current = currentLevel(discussion);

    return (
      <Dropdown
        className={classList('LcoyNotifications', `LcoyNotifications--${current.key}`, { 'LcoyNotifications--compact': this.attrs.compact })}
        buttonClassName={classList('Button', { 'Button--icon': this.attrs.compact })}
        menuClassName="LcoyNotifications-menu"
        icon={current.icon}
        // 实心铃铛与空心铃铛用来区分“关注”和“常规”：论坛强制使用的图标
        // 样式不能把两者变成一样。
        noStyleOverride
        label={this.attrs.compact ? '' : t(`topic.notifications.${current.key}`)}
        caretIcon={this.attrs.compact ? '' : 'fas fa-caret-down'}
        accessibleToggleLabel={t('topic.notifications.toggle', { level: t(`topic.notifications.${current.key}`) })}
        tooltip={this.attrs.compact ? t(`topic.notifications.${current.key}`) : undefined}
      >
        {LEVELS.map((level) => (
          <DetailedDropdownItem
            icon={<Icon name={level.icon} className="Button-icon" noStyleOverride />}
            label={t(`topic.notifications.${level.key}`)}
            description={t(`topic.notifications.${level.key}_description`)}
            active={level.value === current.value}
            onclick={() => {
              if (level.value !== current.value) discussion.save({ subscription: level.value });
            }}
          />
        ))}
      </Dropdown>
    );
  }
}

/** “你会收到通知，因为……”——页脚按钮下方的文字。 */
export function notificationReason(discussion: Discussion): string {
  return t(`topic.notifications.${currentLevel(discussion).key}_reason`);
}
