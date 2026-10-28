import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import LinkButton from 'flarum/common/components/LinkButton';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type Group from 'flarum/common/models/Group';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import CommunityPage from './CommunityPage';
import DirectoryState from './DirectoryState';
import DirectoryTable from './DirectoryTable';
import DirectoryControls from './DirectoryControls';
import GroupFlair from './GroupFlair';
import { fetchGroupActivity } from './api';
import { findGroup, groupSlug, groupsEnabled, memberCount } from './groups';
import { forumBool, t } from '../../utils/settings';
import { fullDate, shortAge } from '../../utils/dates';

type Tab = 'members' | 'activity';

const EXCERPT_LENGTH = 300;

/**
 * Discourse 的用户组页面（/g/:name）：带符号和名称的页头，
 * 以及“成员”和“动态”两个标签。
 *
 * 标签状态放在 URL 本身（?tab=activity）中，原因与目录页相同：
 * 切换标签不应重建页面并丢失已加载的列表。
 */
export default class GroupPage extends CommunityPage {
  group: Group | null = null;
  tab: Tab = 'members';
  members: DirectoryState | null = null;

  posts: Post[] = [];
  postsLoading = false;
  postsLoaded = false;
  postsPage = 0;
  postsHasMore = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    // 先取用户组再调用 `super`：标签页标题来自其名称。
    this.group = findGroup(m.route.param('name'));
    this.tab = m.route.param('tab') === 'activity' && this.activityEnabled() ? 'activity' : 'members';

    super.oninit(vnode);

    if (!this.enabled() || !this.group) return;

    if (this.canViewMembers()) {
      this.members = new DirectoryState({ group: this.group.id(), order: 'username', dir: 'asc' });
      this.members.refresh();
    }

    if (this.tab === 'activity') this.loadActivity();
  }

  title(): string {
    return this.group ? this.group.namePlural() : t('community.groups.title');
  }

  className(): string {
    return 'LcoyGroupPage';
  }

  enabled(): boolean {
    return groupsEnabled();
  }

  activityEnabled(): boolean {
    return forumBool('lcoyGroupsActivity', true);
  }

  canViewMembers(): boolean {
    return forumBool('lcoyCanViewDirectory', false);
  }

  content(): Mithril.Children {
    if (!this.group) {
      return (
        <div className="LcoyGroup">
          <p className="LcoyCommunity-empty">{t('community.groups.not_found')}</p>
          <LinkButton className="Button" href={app.route('lcoy.groups')} icon="fas fa-arrow-left">
            {t('community.groups.back')}
          </LinkButton>
        </div>
      );
    }

    return (
      <div className="LcoyGroup">
        {this.header(this.group)}
        {this.tabs()}
        <div className="LcoyGroup-body">{this.tab === 'activity' ? this.activity() : this.membersView()}</div>
      </div>
    );
  }

  /** `group-details-container`：50px 的 flair、大号名称和 @地址。 */
  header(group: Group): Mithril.Children {
    return (
      <header className="LcoyGroup-header" style={group.color() ? { '--group-color': group.color() } : undefined}>
        <div className="LcoyGroup-info">
          {group.icon() && <GroupFlair group={group} size="large" />}
          <div className="LcoyGroup-headerInfo">
            <h1 className="LcoyGroup-name">{group.namePlural()}</h1>
            <div className="LcoyGroup-mention">@{groupSlug(group)}</div>
          </div>
        </div>
      </header>
    );
  }

  tabs(): Mithril.Children {
    const items = new ItemList<Mithril.Children>();
    const count = this.group ? memberCount(this.group) : null;

    items.add('members', this.tabButton('members', 'fas fa-users', t('community.groups.tab_members'), count), 100);

    if (this.activityEnabled()) {
      items.add('activity', this.tabButton('activity', 'fas fa-bars', t('community.groups.tab_activity')), 90);
    }

    return (
      <nav className="LcoyGroup-tabs" aria-label={t('community.groups.tabs_label')}>
        <ul>{items.toArray()}</ul>
      </nav>
    );
  }

  tabButton(tab: Tab, icon: string, label: string, count: number | null = null): Mithril.Children {
    const active = this.tab === tab;

    return (
      <li className={classList({ active })}>
        <Button
          className={classList('Button LcoyGroup-tab', { active })}
          icon={icon}
          aria-current={active ? 'page' : undefined}
          onclick={() => this.setTab(tab)}
        >
          {label}
          {count !== null && <span className="LcoyGroup-tabCount">({count})</span>}
        </Button>
      </li>
    );
  }

  setTab(tab: Tab): void {
    this.tab = tab;

    if (tab === 'activity' && !this.postsLoaded && !this.postsLoading) this.loadActivity();

    const url = app.route('lcoy.group', { name: m.route.param('name') }) + (tab === 'activity' ? '?tab=activity' : '');
    window.history.replaceState(window.history.state, '', url);
  }

  membersView(): Mithril.Children {
    if (!this.members) {
      return (
        <p className="LcoyCommunity-empty">{app.session.user ? t('community.groups.members_forbidden') : t('community.groups.members_login')}</p>
      );
    }

    return [<DirectoryControls state={this.members} />, <DirectoryTable state={this.members} emptyText={t('community.groups.no_members')} />];
  }

  loadActivity(): void {
    if (!this.group) return;

    this.postsLoading = true;
    const page = this.postsPage + 1;

    fetchGroupActivity(this.group.id()!, page)
      .then((response) => {
        this.postsHasMore = response.meta.hasMore;
        this.postsPage = page;

        if (!response.data.length) return [] as Post[];

        // id 已按可见性过滤；/api/posts 会序列化每条帖子，
        // 并包含各扩展添加的内容。
        return app.store.find<Post[]>('posts', {
          filter: { id: response.data.join(',') },
          include: 'user,discussion',
          page: { limit: response.data.length },
        } as any);
      })
      .then((posts) => {
        const sorted = [...posts].sort((a, b) => (b.createdAt()?.getTime() || 0) - (a.createdAt()?.getTime() || 0));
        this.posts = [...this.posts, ...sorted];
      })
      .catch(() => {})
      .finally(() => {
        this.postsLoading = false;
        this.postsLoaded = true;
        m.redraw();
      });
  }

  activity(): Mithril.Children {
    if (!this.postsLoaded && this.postsLoading) return <LoadingIndicator display="block" />;

    if (!this.posts.length) return <p className="LcoyCommunity-empty">{t('community.groups.no_activity')}</p>;

    return (
      <div className="LcoyGroup-activity">
        <ul className="LcoyStream">{this.posts.map((post) => this.streamItem(post))}</ul>
        {this.postsLoading && <LoadingIndicator display="block" />}
        {!this.postsLoading && this.postsHasMore && (
          <div className="LcoyCommunity-more">
            <Button className="Button" onclick={() => this.loadActivity()}>
              {t('community.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  /** Discourse 用户动态流中的一项：头像、主题、时间和文本开头。 */
  streamItem(post: Post): Mithril.Children {
    const user = post.user();
    const discussion = post.discussion();
    const createdAt = post.createdAt();

    return (
      <li key={post.id()} className="LcoyStream-item">
        <div className="LcoyStream-header">
          {user ? (
            <Link href={app.route.user(user)} className="LcoyStream-avatar">
              <Avatar user={user} />
            </Link>
          ) : (
            <span className="LcoyStream-avatar">
              <Avatar user={null} />
            </span>
          )}
          <div className="LcoyStream-titles">
            {discussion && (
              <Link href={app.route.post(post)} className="LcoyStream-topic">
                {discussion.title()}
              </Link>
            )}
            <span className="LcoyStream-meta">
              {user && <Link href={app.route.user(user)}>{user.displayName()}</Link>}
              {createdAt && (
                <time datetime={createdAt.toISOString()} title={fullDate(createdAt)}>
                  {shortAge(createdAt)}
                </time>
              )}
            </span>
          </div>
        </div>
        <p className="LcoyStream-excerpt">{truncate(post.contentPlain() || '', EXCERPT_LENGTH)}</p>
      </li>
    );
  }
}
