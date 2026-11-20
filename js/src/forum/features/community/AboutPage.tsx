import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import AboutNav from './AboutNav';
import CommunityPage from './CommunityPage';
import UserTile from './UserTile';
import { fetchAbout, pushUsers, type AboutPayload, type StatPeriod } from './api';
import { forumBool, t } from '../../utils/settings';
import { fullDate } from '../../utils/dates';

/** 统计表的各行，按 Discourse 的顺序排列，每行带对应图标。 */
const STAT_ROWS: [key: string, icon: string][] = [
  ['topics', 'far fa-comments'],
  ['posts', 'far fa-comment'],
  ['users', 'fas fa-user-plus'],
  ['activeUsers', 'fas fa-user-check'],
  ['likes', 'far fa-heart'],
];

const STAT_PERIODS: StatPeriod[] = ['day', 'week', 'month', 'all'];

/**
 * Discourse 的“关于”页面（/about）：论坛、管理员撰写的介绍、
 * 如何联系团队、团队成员以及站点数据。
 */
export default class AboutPage extends CommunityPage {
  data: AboutPayload | null = null;
  failed = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (this.enabled()) this.load();
  }

  title(): string {
    return t('community.about.title');
  }

  className(): string {
    return 'LcoyAboutPage';
  }

  enabled(): boolean {
    return forumBool('lcoyAboutEnabled', true);
  }

  load(): void {
    fetchAbout()
      .then((data) => {
        pushUsers(data.included || []);
        this.data = data;
      })
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());
  }

  content(): Mithril.Children {
    return <div className="LcoyAbout">{this.sectionItems().toArray()}</div>;
  }

  sectionItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const data = this.data;

    items.add('header', this.header(), 100);

    if (this.failed) {
      items.add('error', <p className="LcoyCommunity-empty">{t('community.load_error')}</p>, 90);
      return items;
    }

    if (!data) {
      items.add('loading', this.skeleton(), 90);
      return items;
    }

    items.add(
      'main',
      <div className="LcoyAbout-main">
        <div className="LcoyAbout-left">{this.leftItems(data).toArray()}</div>
        <aside className="LcoyAbout-right">{this.rightItems(data).toArray()}</aside>
      </div>,
      80
    );

    if (data.stats) items.add('stats', this.statsTable(data.stats), 70);

    return items;
  }

  /**
   * 数据尚未到达：两列沿用真实内容的类名（数字条、带用户卡片的
   * 团队以及右侧的站点活跃度），已确定的标题保留，其余位置用
   * 骨架条占位：内容到达时正落在骨架所在的位置。
   */
  skeleton(): Mithril.Children {
    const line = (width: string) => <span className="LcoySkeleton LcoySkeleton--line" style={{ width }} />;

    return (
      <div className="LcoyAbout-main LcoyAbout-main--loading" aria-busy="true">
        <div className="LcoyAbout-left">
          <ul className="LcoyAbout-summary">
            {['6em', '9em', '9em', '9em'].map((width) => (
              <li className="LcoyAbout-summaryItem">{line(width)}</li>
            ))}
          </ul>
          <section className="LcoyAbout-staff">
            <h2 className="LcoyAbout-sectionTitle">{t('community.about.our_admins')}</h2>
            <ul className="LcoyAbout-users">
              <li>
                <div className="LcoyUserTile LcoyUserTile--normal">
                  <span className="LcoyUserTile-avatar">
                    <span className="Avatar LcoySkeleton" />
                  </span>
                  <div className="LcoyUserTile-info">
                    <span className="LcoyUserTile-name">{line('5em')}</span>
                    <span className="LcoyUserTile-title">{line('3em')}</span>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>
        <aside className="LcoyAbout-right">
          <section className="LcoyAbout-box LcoyAbout-activity">
            <h2 className="LcoyAbout-sectionTitle">{t('community.about.activity_title')}</h2>
            <ul className="LcoyAbout-activityList">
              {['8em', '9em', '7em', '10em', '7em'].map((width) => (
                <li className="LcoyAbout-activityItem">
                  <span className="LcoyAbout-activityIcon">
                    <span className="LcoySkeleton LcoySkeleton--word" style={{ width: '1em' }} />
                  </span>
                  <span className="LcoyAbout-activityText">
                    <span className="LcoyAbout-activityCount">{line(width)}</span>
                    <span className="LcoyAbout-activityPeriod">{line('6em')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    );
  }

  /** 顶部标签（关于、准则、条款、隐私）、论坛名称和描述。 */
  header(): Mithril.Children {
    const description = app.forum.attribute<string>('description');

    return (
      <header className="LcoyAbout-header">
        {AboutNav('lcoy.about')}
        <h1 className="LcoyAbout-title">{app.forum.attribute<string>('title')}</h1>
        {description && <p className="LcoyAbout-description">{description}</p>}
      </header>
    );
  }

  /** 标题下方的数字条：成员数、团队人数和论坛年龄。 */
  summary(data: AboutPayload): Mithril.Children {
    const items = new ItemList<Mithril.Children>();

    items.add('members', this.summaryItem('fas fa-users', t('community.about.members', { count: data.members })), 100);

    if (data.adminCount !== null) {
      items.add('admins', this.summaryItem('fas fa-shield-halved', t('community.about.admin_count', { count: data.adminCount })), 90);
    }

    if (data.moderatorCount !== null) {
      items.add('moderators', this.summaryItem('fas fa-shield', t('community.about.moderator_count', { count: data.moderatorCount })), 80);
    }

    if (data.createdAt) {
      // “创建于 11 年前”，与 Discourse 一样使用相对时间；精确日期放在 title 中。
      const created = new Date(data.createdAt);
      items.add(
        'created',
        this.summaryItem('far fa-calendar', t('community.about.created_ago', { ago: dayjs(created).fromNow() }), fullDate(created)),
        70
      );
    }

    return <ul className="LcoyAbout-summary">{items.toArray()}</ul>;
  }

  summaryItem(icon: string, text: string, title?: string): Mithril.Children {
    return (
      <li className="LcoyAbout-summaryItem" title={title}>
        <Icon name={icon} />
        <span>{text}</span>
      </li>
    );
  }

  leftItems(data: AboutPayload): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    items.add('summary', this.summary(data), 110);

    // 文本由管理员提供（他自己编写的 HTML，或由论坛格式化器在
    // 服务端已渲染的 Markdown）。
    if (data.aboutHtml) {
      items.add(
        'text',
        <section className="LcoyAbout-about">
          <h2 className="LcoyAbout-sectionTitle">{t('community.about.title')}</h2>
          <div className="LcoyAbout-text">{m.trust(data.aboutHtml)}</div>
        </section>,
        100
      );
    }

    if (data.admins?.length) items.add('admins', this.staffSection('admins', t('community.about.our_admins'), data.admins), 90);
    if (data.moderators?.length) items.add('moderators', this.staffSection('moderators', t('community.about.our_moderators'), data.moderators), 80);

    return items;
  }

  staffSection(name: string, title: string, ids: string[]): Mithril.Children {
    const users = ids.map((id) => app.store.getById<User>('users', id)).filter((user): user is User => !!user);

    return (
      <section className={`LcoyAbout-staff LcoyAbout-staff--${name}`}>
        <h2 className="LcoyAbout-sectionTitle">{title}</h2>
        <ul className="LcoyAbout-users">
          {users.map((user) => (
            <li key={user.id()}>
              <UserTile user={user} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  rightItems(data: AboutPayload): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    if (data.contactEmail || data.contactUrl) items.add('contact', this.contact(data), 100);
    if (data.stats) items.add('activity', this.activity(data.stats), 90);

    return items;
  }

  contact(data: AboutPayload): Mithril.Children {
    return (
      <section className="LcoyAbout-box LcoyAbout-contact">
        <h2 className="LcoyAbout-sectionTitle">{t('community.about.contact_title')}</h2>
        <p className="LcoyAbout-contactInfo">
          {t('community.about.contact_text')} {data.contactEmail && <a href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a>}
          {data.contactEmail && data.contactUrl && ' · '}
          {data.contactUrl && (
            <a href={data.contactUrl} target="_blank" rel="noopener noreferrer">
              {data.contactUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </p>
      </section>
    );
  }

  /** “站点活跃度”：Discourse 的周数据列。 */
  activity(stats: NonNullable<AboutPayload['stats']>): Mithril.Children {
    const rows = STAT_ROWS.filter(([key]) => stats[key]);

    return (
      <section className="LcoyAbout-box LcoyAbout-activity">
        <h2 className="LcoyAbout-sectionTitle">{t('community.about.activity_title')}</h2>
        <ul className="LcoyAbout-activityList">
          {rows.map(([key, icon]) => {
            // 该列显示一周的数据，与 Discourse 一致；下方表格包含
            // 其他时间段。
            const count = stats[key].week ?? 0;

            return (
              <li className="LcoyAbout-activityItem">
                <span className="LcoyAbout-activityIcon">
                  <Icon name={icon} />
                </span>
                <span className="LcoyAbout-activityText">
                  <span className="LcoyAbout-activityCount">{t(`community.about.activity.${key}`, { count, formatted: formatNumber(count) })}</span>
                  <span className="LcoyAbout-activityPeriod">{t('community.about.last_7_days')}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  statsTable(stats: NonNullable<AboutPayload['stats']>): Mithril.Children {
    const rows = STAT_ROWS.filter(([key]) => stats[key]);

    return (
      <section className="LcoyAbout-statsSection">
        <h2 className="LcoyAbout-sectionTitle">{t('community.about.stats_title')}</h2>
        <div className="LcoyCommunity-tableWrap">
          <table className="LcoyCommunity-table LcoyAbout-statsTable">
            <thead>
              <tr>
                <th />
                {STAT_PERIODS.map((period) => (
                  <th className="LcoyCommunity-num">{t(`community.about.period.${period}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, icon]) => (
                <tr>
                  <th scope="row">
                    <Icon name={icon} className="LcoyAbout-statsIcon" />
                    {t(`community.about.stat.${key}`)}
                  </th>
                  {STAT_PERIODS.map((period) => {
                    const value = stats[key][period];

                    return <td className="LcoyCommunity-num">{value === null || value === undefined ? '-' : formatNumber(value)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
}
