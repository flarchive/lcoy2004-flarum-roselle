/*
 * lcoy/recommendations 在主题里的位置：侧栏的「推荐」分区。
 *
 * 扩展把三组列表（推荐 / 最新 / 最多浏览）做成 fof/forum-widgets-core 的小组件，
 * 而后台的布局把它锚在内容区顶部：600px 宽的盒子塞三列各约 180px，用的还是 Flarum
 * 核心变量，跟主题的卡片和排版脱节 —— 这就是它「突兀」的地方。
 *
 * 主题的做法跟 Discourse 的侧栏一样：内容类的列表进侧栏。这里把三组收成一个可
 * 折叠的分区「推荐」，组之间用分区内的小标签页切换，条目按两行纵向排列（标题在上，
 * 作者和计数在下）。扩展的小组件被拦下（WidgetManager::get 里过滤掉），主题的分区
 * 接手，两者不会同时出现。
 *
 * 两种情况主题不接管：主题的侧栏关掉时（lcoy.sidebar_enabled），小组件回到内容区；
 * 后台在 FoF 的布局编辑器里关掉这个小组件时，两边都不显示。
 *
 * 数据来自扩展：首页 payload 里的 `lcoy-recommendations-data` 命中就零请求（缓存
 * 命中时即时渲染），否则去 /api/lcoy-recommendations 取一次；结果留在内存里，换页
 * 不再重复请求。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import humanTime from 'flarum/common/utils/humanTime';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import LcoySidebar from '../components/LcoySidebar';
import SidebarSection from '../components/SidebarSection';
import { t } from '../utils/settings';
import { thirdParty } from './settings';

/** 小组件的 id 是 WidgetManager 拼出来的：`${扩展 id}:${key}`。 */
const WIDGET_ID = 'lcoy-recommendations:lcoyRecommendations';

/** 扩展的三组列表，用她自己的名字。 */
type Group = 'recommended' | 'latest' | 'mostViewed';

const GROUPS: Group[] = ['recommended', 'latest', 'mostViewed'];

/**
 * 标签页用主题自己的短标签：扩展的「推荐帖子 / 最新帖子 / 热门浏览」四个字在
 * 侧栏这么窄的地方会被截成「推荐…」，两个字的版本放得下，也和主题列表页的
 * 那排标签（最新 / 热门 / 新帖 …）是一个口径。
 */
const GROUP_LABELS: Record<Group, string> = {
  recommended: 'sidebar.recommendation_recommended',
  latest: 'sidebar.recommendation_latest',
  mostViewed: 'sidebar.recommendation_most_viewed',
};

/** 一条列表项，字段同扩展后端的 `serializeItem`。 */
interface Recommendation {
  id: number;
  title: string;
  slug: string;
  createdAt: string;
  commentCount: number;
  viewCount: number;
  user: { displayName: string; avatarUrl: string | null } | null;
}

type Lists = Record<Group, Recommendation[]>;

/** 已到手的数据：首页 payload 里的，或者接口返回的。 */
let cache: Lists | null = null;
let pending: Promise<Lists> | null = null;

function lists(): Lists | null {
  const fromPayload = app.forum.attribute<Lists | undefined>('lcoy-recommendations-data');

  // payload 总比上一页留下的那份新。
  if (fromPayload) cache = fromPayload;

  return cache;
}

/** 同一时刻只发一个请求；这次失败的话，下一页还能再试。 */
function fetchLists(): Promise<Lists> {
  if (pending) return pending;

  const request = app.request<Lists>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/lcoy-recommendations` }).then(
    (result: Lists) => {
      cache = result;
      pending = null;

      return result;
    },
    (error: unknown) => {
      pending = null;

      throw error;
    }
  );

  pending = request;

  return request;
}

/** 主题接管的两个前提：扩展在、侧栏开着，且后台没在 FoF 里关掉这个小组件。 */
function takeOver(): boolean {
  const config = ((app as any).widgets?.config ?? {}) as { disabled?: string[] };

  return thirdParty.recommendationsSidebar() && !(config.disabled ?? []).includes(WIDGET_ID);
}

const GROUP_STORAGE = 'lcoy.recommendationsGroup';

/** 读者选的标签页留在浏览器里，跟「折叠了哪个分区」一样。 */
function readGroup(): Group {
  try {
    const saved = localStorage.getItem(GROUP_STORAGE) as Group | null;

    return saved && GROUPS.includes(saved) ? saved : 'recommended';
  } catch {
    return 'recommended';
  }
}

function saveGroup(group: Group): void {
  try {
    localStorage.setItem(GROUP_STORAGE, group);
  } catch {
    // 没有存储时，选择只管到刷新为止。
  }
}

/**
 * 行尾那一块：回帖数（推荐）和发布时间（最新）。
 *
 * 「热门」一组不带浏览量：那一组就是按浏览量排的，行尾再写一遍数字、配个眼睛
 * 图标，只是把同一件事说了两遍。
 */
function stat(group: Group, item: Recommendation): Mithril.Children {
  if (group === 'mostViewed') return null;

  if (group === 'recommended')
    return (
      <span className="LcoySidebar-recommendationStat">
        <Icon name="far fa-comment" />
        {abbreviateNumber(item.commentCount)}
      </span>
    );

  return (
    <span className="LcoySidebar-recommendationStat">
      <Icon name="far fa-clock" />
      {humanTime(new Date(item.createdAt))}
    </span>
  );
}

function itemRow(group: Group, item: Recommendation): Mithril.Children {
  const user = item.user;
  const avatar = user?.avatarUrl ?? null;

  return (
    <li className="LcoySidebar-recommendation">
      <Link className="LcoySidebar-recommendationLink" href={app.route('discussion', { id: item.id, slug: item.slug })} title={item.title}>
        <span className="LcoySidebar-recommendationTitle">{item.title}</span>
        <span className="LcoySidebar-recommendationMeta">
          {avatar ? (
            <img className="LcoySidebar-recommendationAvatar" src={avatar} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="LcoySidebar-recommendationAvatar LcoySidebar-recommendationAvatar--empty" />
          )}
          {user && <span className="LcoySidebar-recommendationUser">{user.displayName}</span>}
          {stat(group, item)}
        </span>
      </Link>
    </li>
  );
}

/** 侧栏的分区：上面一排标签页，下面是选中的那一组。 */
class RecommendationsSection extends Component {
  group: Group = readGroup();
  error = false;

  oninit(vnode: Mithril.Vnode<Mithril.Attributes, this>) {
    super.oninit(vnode);

    if (lists()) {
      this.pickDefaultGroup();

      return;
    }

    fetchLists().then(
      () => {
        this.pickDefaultGroup();
        m.redraw();
      },
      () => {
        this.error = true;
        m.redraw();
      }
    );
  }

  /**
   * 打开时先落在有内容的那一组：「推荐」只取最近 60 天的帖子，论坛冷下来时
   * 它是空的，默认停在那儿只会看到「暂无帖子」。点过标签页之后就不再改。
   */
  pickDefaultGroup(): void {
    const data = lists();

    if (!data || (data[this.group]?.length ?? 0) > 0) return;

    const first = GROUPS.find((group) => (data[group]?.length ?? 0) > 0);

    if (first) this.group = first;
  }

  view(): Mithril.Children {
    const data = lists();

    // 数据在路上、或者没拿到：分区先不长出来。与其在侧栏里空一块，不如等
    // 数据到了再出现；真出错了才把扩展那句话摆出来。
    if (!data) {
      if (!this.error) return null;

      return (
        <SidebarSection name="recommendations" title={t('sidebar.recommendations')}>
          <li className="LcoySidebar-recommendation">
            <p className="LcoySidebar-recommendationNote">{app.translator.trans('lcoy-recommendations.forum.widget.load_error')}</p>
          </li>
        </SidebarSection>
      );
    }

    // 三个标签页始终都在（推荐 / 最新 / 热门），空的那一组也不隐藏：扩展只取
    // 最近 60 天的帖子，论坛冷下来时「推荐」就是空的，藏掉标签页反而让这区
    // 看起来少了一栏。点哪个就停在哪个，空的显示扩展自己的「暂无帖子」。
    const tabs = GROUPS;
    const active = this.group;
    const items = data[active] ?? [];

    return (
      <SidebarSection name="recommendations" title={t('sidebar.recommendations')}>
        <li className="LcoySidebar-recommendations">
          <div className="LcoySidebar-recommendationTabs" role="tablist">
            {tabs.map((group) => (
              <button
                type="button"
                role="tab"
                className={classList('LcoySidebar-recommendationTab', { active: active === group })}
                aria-selected={active === group ? 'true' : 'false'}
                onclick={() => this.select(group)}
              >
                {t(GROUP_LABELS[group])}
              </button>
            ))}
          </div>
          <ul className="LcoySidebar-recommendationList">
            {items.length ? (
              items.map((item) => itemRow(active, item))
            ) : (
              <li className="LcoySidebar-recommendation">
                <p className="LcoySidebar-recommendationNote">{app.translator.trans('lcoy-recommendations.forum.widget.empty')}</p>
              </li>
            )}
          </ul>
        </li>
      </SidebarSection>
    );
  }

  select(group: Group): void {
    if (this.group === group) return;

    this.group = group;
    saveGroup(group);
  }
}

export default function installRecommendations(): void {
  // 小组件从内容区让位：`get` 是按位置分出各区块的，这里在它返回的数组里
  // 摘掉这个小组件，它就到不了任何一个区块。
  extend('ext:fof/forum-widgets-core/common/WidgetManager', 'get', function (this: any, widgets: any[]) {
    if (!Array.isArray(widgets) || !takeOver()) return;

    const index = widgets.findIndex((widget) => widget?.id === WIDGET_ID);

    if (index !== -1) widgets.splice(index, 1);
  });

  extend(LcoySidebar.prototype, 'sectionItems', function (this: LcoySidebar, items: ItemList<Mithril.Children>) {
    if (!takeOver()) return;

    // 紧跟在社区分区（90）后面：侧栏自己要滚动，分类和标签合起来一千多像素，
    // 放在列表末尾的话这一区只有滚到底才看得见。
    items.add('recommendations', <RecommendationsSection />, 88);
  });
}
