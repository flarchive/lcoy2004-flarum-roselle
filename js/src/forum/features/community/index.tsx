/*
 * Discourse 风格的社区页面：关于（/about）、用户（/u）和
 * 用户组（/g、/g/:name）。此处是通往其他区域的入口：侧边栏
 * “更多”菜单中的链接，以及个人资料页中可点击的用户组。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import type ItemList from 'flarum/common/utils/ItemList';
import type Group from 'flarum/common/models/Group';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import LcoySidebar from '../../components/LcoySidebar';
import { forumBool, t } from '../../utils/settings';
import { groupsEnabled, groupUrl } from './groups';
import { guidelinesEnabled } from './AboutNav';

export default function installCommunity() {
  extendSidebarMore();
  extendProfileGroups();
}

function extendSidebarMore() {
  extend(LcoySidebar.prototype, 'moreItems', function (items: ItemList<Mithril.Children>) {
    // 紧接在“设置”（80）下方、“快捷方式”（10）上方，遵循
    // Discourse 的“更多”菜单顺序。
    if (forumBool('lcoyAboutEnabled', true)) {
      items.add(
        'lcoyAbout',
        <LinkButton href={app.route('lcoy.about')} icon="fas fa-circle-info">
          {t('community.about.title')}
        </LinkButton>,
        75
      );
    }

    // “准则”（Discourse 菜单中原先的“FAQ”）。
    if (guidelinesEnabled()) {
      items.add(
        'lcoyGuidelines',
        <LinkButton href={app.route('lcoy.guidelines')} icon="fas fa-circle-question">
          {t('community.guidelines.title')}
        </LinkButton>,
        74.5
      );
    }

    if (groupsEnabled()) {
      items.add(
        'lcoyGroups',
        <LinkButton href={app.route('lcoy.groups')} icon="fas fa-user-group">
          {t('community.groups.title')}
        </LinkButton>,
        74
      );
    }
  });
}

/**
 * 个人资料卡片中的用户组标签（`lcoyGroups` 项，由个人资料区域
 * 放置）会变成指向 /g/:name 的链接。仅当该项存在时才替换：标签的
 * 渲染属于个人资料区域——此处只为其添加链接——因此本安装必须
 * 在个人资料之后执行。
 */
function extendProfileGroups() {
  extend(UserCard.prototype, 'contentItems', function (this: UserCard, items: ItemList<Mithril.Children>) {
    if (!items.has('lcoyGroups') || !groupsEnabled() || !forumBool('lcoyGroupsProfileLinks', true)) return;

    const user = (this.attrs as { user: User }).user;
    const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);

    items.setContent(
      'lcoyGroups',
      <ul className="LcoyUserHero-groups">
        {groups.map((group) => (
          <li className="LcoyGroupPill LcoyGroupPill--link" style={group.color() ? { '--group-color': group.color() } : undefined}>
            <Link href={groupUrl(group)} className="LcoyGroupPill-link">
              {group.icon() ? <Icon name={group.icon()!} className="LcoyGroupPill-icon" /> : <span className="LcoyGroupPill-dot" />}
              <span className="LcoyGroupPill-name">{group.nameSingular()}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  });
}
