/*
 * fof/forum-widgets-core：右侧那列小组件改到主题侧栏里。
 *
 * 扩展把 `end` 位置的 widget 画在 `.FofWidgets-sideNavAlt` 里 —— 一个 180px 宽、
 * 贴在内容右侧的列。主题的 `.Page-container` 是限宽 1110px 的居中卡片，这一列
 * 作为卡片的兄弟超出卡片右边界：1440px 的窗口里它从 x=1428 开始、到 1608 结束，
 * 只有十来像素露在屏幕内，还把文档撑宽 168px，整页出现横向滚动条。
 *
 * 主题的做法和「Loja」「推荐」一致：不画这一列，把每个 widget 变成侧栏里一个
 * 可折叠分区（标题用 widget 自己的 title，内容的卡片样式在
 * less/forum/thirdparty/FofWidgets.less 里去掉）。widget 本体照常挂载，所以
 * 它们自己的数据加载（活跃用户、在线用户）还是走各自的生命周期。
 *
 * 主题侧栏关掉时不接管：那时没有侧栏可放，仍由扩展自己画那一列。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import LcoySidebar from '../components/LcoySidebar';
import SidebarSection from '../components/SidebarSection';
import { forumBool, t } from '../utils/settings';

function takeOver(): boolean {
  return forumBool('lcoySidebarEnabled', true);
}

/** widget 的标题；`fof/news-widget` 没有标题，用主题给它的名字。 */
function sectionTitle(widget: any): Mithril.Children {
  try {
    const title = new widget.component({}).title?.();

    if (title) return title;
  } catch {
    // Widget 的 title 依赖实例状态时拿不到：退回通用名字。
  }

  return widget.key === 'news' ? t('sidebar.widget_news') : t('sidebar.widgets');
}

/** 已可变成区块的小部件，带排序用的键。 */
interface WidgetSection {
  key: string;
  node: Mithril.Children;
}

/**
 * 侧边栏不显示的小部件。
 *
 * `topPosters` 是 fof/top-posters-widget 的 "本月发帖之星"：该列表每月
 * 变化，占用了整个侧边栏区块。它仍然安装（搜索的
 * `top_poster` 过滤器继续可用），但不会变成区块。
 */
const HIDDEN_WIDGETS = new Set(['topPosters']);

/** 每个小部件一个区块，顺序同后台布局中的 position。 */
function widgetSections(): WidgetSection[] {
  const widgets = (app.widgets?.get('end') ?? [])
    .filter((widget: any) => !HIDDEN_WIDGETS.has(widget.key))
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

  return widgets.map((widget: any) => ({
    key: widget.key,
    node: (
      <SidebarSection name={`fof-${widget.key}`} title={sectionTitle(widget)}>
        <li className="LcoySidebar-fofWidget">{widget.component.component({ state: widget.state })}</li>
      </SidebarSection>
    ),
  }));
}

export default function installFofWidgets(): void {
  // 那一列不再画：换成侧栏的分区。
  override('ext:fof/forum-widgets-core/forum/components/EndWidgetSection', 'view', function (this: any, original: () => Mithril.Children) {
    return takeOver() ? null : original();
  });

  extend(LcoySidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    if (!takeOver()) return;

    // 公告紧挨着社区（90），在「推荐」（88）上面：那是要最先看到的一句话。
    // 其余 widget（在线用户、活跃用户、论坛统计）排在标签和推荐之后。
    widgetSections().forEach(({ key, node }, index) => {
      items.add(`fofWidget-${key}`, node, key === 'news' ? 89 : 60 - index);
    });
  });
}
