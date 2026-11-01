import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

import CommunityPage from './CommunityPage';
import GroupFlair from './GroupFlair';
import { communityGroups, groupsEnabled, groupSlug, groupUrl, memberCount } from './groups';
import { t } from '../../utils/settings';

/**
 * Discourse 的用户组列表（/g）：每个组一张卡片，显示符号、
 * 名称和成员数。
 *
 * 用户组已在论坛 payload 中下发——仅当前用户可见的组——因此
 * 该页面不发起任何请求。
 */
export default class GroupsPage extends CommunityPage {
  title(): string {
    return t('community.groups.title');
  }

  className(): string {
    return 'LcoyGroupsPage';
  }

  enabled(): boolean {
    return groupsEnabled();
  }

  /** 顶部按名称筛选（`groups-header-filters`），仅在浏览器端生效。 */
  filter = '';

  content(): Mithril.Children {
    const query = this.filter.trim().toLowerCase();
    const groups = communityGroups().filter(
      (group) => !query || [group.namePlural(), group.nameSingular(), groupSlug(group)].some((name) => (name || '').toLowerCase().includes(query))
    );

    return (
      <div className="LcoyGroups">
        <h1 className="sr-only">{t('community.groups.title')}</h1>
        <div className="LcoyGroups-header">
          <input
            className="FormControl LcoyGroups-filter"
            type="search"
            placeholder={t('community.groups.filter_placeholder')}
            aria-label={t('community.groups.filter_placeholder')}
            value={this.filter}
            oninput={(event: InputEvent) => (this.filter = (event.target as HTMLInputElement).value)}
          />
        </div>
        {groups.length ? (
          <ul className="LcoyGroups-grid">{groups.map((group) => this.card(group))}</ul>
        ) : (
          <p className="LcoyCommunity-empty">{t('community.groups.empty')}</p>
        )}
      </div>
    );
  }

  /**
   * Discourse 的 `group-box`：圆形 flair、大号名称及其下方的 @地址、
   * 角落中的成员数，以及底部的加入状态——在 Flarum 中只有管理员
   * 能把用户加入用户组，因此所有组均为“关闭”。
   */
  card(group: Group): Mithril.Children {
    const count = memberCount(group);

    return (
      <li key={group.id()} className="LcoyGroups-item">
        <Link className="LcoyGroupCard" href={groupUrl(group)} style={group.color() ? { '--group-color': group.color() } : undefined}>
          <span className="LcoyGroupCard-inner">
            <span className="LcoyGroupCard-infoWrapper">
              {group.icon() && <GroupFlair group={group} />}
              <span className="LcoyGroupCard-info">
                <span className="LcoyGroupCard-details">
                  <span className="LcoyGroupCard-name">{group.namePlural()}</span>
                  <span className="LcoyGroupCard-mention">@{groupSlug(group)}</span>
                </span>
                {count !== null && (
                  <span className="LcoyGroupCard-count" title={t('community.groups.members', { count })}>
                    <Icon name="far fa-user" />
                    {count}
                  </span>
                )}
              </span>
            </span>
            <span className="LcoyGroupCard-membership">
              {group.isHidden() ? (
                <span className="LcoyGroupCard-hidden">
                  <Icon name="far fa-eye-slash" /> {t('community.groups.hidden')}
                </span>
              ) : (
                <span>
                  <Icon name="fas fa-ban" /> {t('community.groups.closed')}
                </span>
              )}
            </span>
          </span>
        </Link>
      </li>
    );
  }
}
