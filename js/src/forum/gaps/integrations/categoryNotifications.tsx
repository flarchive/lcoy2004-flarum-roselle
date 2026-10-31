/*
 * Discourse 的分类通知铃铛（category-notifications-
 * tracking），位于“发起讨论”旁的导航栏中，底层使用
 * fof/follow-tags——扩展负责保存级别、发送通知并隐藏主题；主题只更换外壳。
 *
 * follow-tags 把自己的按钮放在 IndexSidebar，而主题在列表页面隐藏了它
 *（导航移到了全局栏）；因此铃铛放在这里。它的级别映射为 Discourse 的：
 * lurk = 关注，follow = 关注第一楼，无 = 常规，ignore = 静音，
 * hide = 静音且不出现在“最新”列表中。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Dropdown from 'flarum/common/components/Dropdown';
import DetailedDropdownItem from 'flarum/common/components/DetailedDropdownItem';
import Icon from 'flarum/common/components/Icon';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ListNavigation from '../../list/ListNavigation';
import { currentTag } from '../../utils/tags';
import { isExtensionEnabled, t } from '../../utils/settings';

interface Level {
  value: string | null;
  key: string;
  icon: string;
}

const LEVELS: Level[] = [
  { value: 'lurk', key: 'watching', icon: 'fas fa-bell' },
  { value: 'follow', key: 'watching_first_post', icon: 'far fa-circle-dot' },
  { value: null, key: 'normal', icon: 'far fa-bell' },
  { value: 'ignore', key: 'muted', icon: 'fas fa-bell-slash' },
  { value: 'hide', key: 'hidden', icon: 'far fa-eye-slash' },
];

let saving = false;

function currentLevel(tag: any): Level {
  const value = tag.attribute('subscription') ?? null;

  return LEVELS.find((level) => level.value === value) || LEVELS[2];
}

function choose(tag: any, level: Level): void {
  if (saving || currentLevel(tag).value === level.value) return;

  saving = true;

  tag
    .save({ subscription: level.value })
    .then(() => {
      // “静音并隐藏”会改变“最新”列表显示的内容。
      if (level.value === 'hide' || currentLevel(tag).value === 'hide') app.discussions.refresh();
    })
    .catch(() => {})
    .finally(() => {
      saving = false;
      m.redraw();
    });
}

function bell(tag: any): Mithril.Children {
  const current = currentLevel(tag);
  const label = t(`gaps.category_notifications.${current.key}`);

  return (
    <Dropdown
      className={classList('LcoyNotifications LcoyNotifications--compact LcoyCategoryNotifications', `LcoyNotifications--${current.key}`)}
      buttonClassName="Button Button--icon"
      menuClassName="LcoyNotifications-menu Dropdown-menu--right"
      icon={current.icon}
      noStyleOverride
      label=""
      caretIcon=""
      accessibleToggleLabel={t('gaps.category_notifications.toggle', { level: label })}
      tooltip={label}
    >
      {LEVELS.map((level) => (
        <DetailedDropdownItem
          icon={<Icon name={level.icon} className="Button-icon" noStyleOverride />}
          label={t(`gaps.category_notifications.${level.key}`)}
          description={t(`gaps.category_notifications.${level.key}_description`)}
          active={level.value === current.value}
          onclick={() => choose(tag, level)}
        />
      ))}
    </Dropdown>
  );
}

let installed = false;

export default function installCategoryNotifications(): void {
  extend(ListNavigation.prototype, 'endItems', function (items: ItemList<Mithril.Children>) {
    if (!isExtensionEnabled('fof-follow-tags') || !app.session.user) return;

    const tag = currentTag();

    if (!tag) return;

    // 紧靠“发起讨论”（50）左侧，与 Discourse 一致。
    items.add('lcoyCategoryNotifications', bell(tag), 55);
  });

  // follow-tags 在 IndexSidebar 的按钮（“眼睛”，在手机上会移到
  // 头部）会与铃铛重复：移除。放在 beforeMount，以便在 follow-tags
  // 自身的 extend 之后运行——它注册在主题之后。
  app.beforeMount(() => {
    if (installed) return;
    installed = true;

    extend(IndexSidebar.prototype, 'items', function (items: ItemList<Mithril.Children>) {
      if (isExtensionEnabled('fof-follow-tags') && items.has('subscriptionButton')) items.remove('subscriptionButton');
    });
  });
}
