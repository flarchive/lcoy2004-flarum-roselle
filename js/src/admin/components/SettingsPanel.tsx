/*
 * 面板外壳：左侧的分组（在手机上为顶部可横向滚动的条）、
 * 搜索、“正在保存…/已保存”指示器以及当前分组的卡片。
 *
 * 依赖关系：每张带 `master` 的卡片都会注册其开关所需的条件
 * （`dependsOn`、`extensions`、`lockedBy`）。`dependsOn`
 * 已关闭的卡片会离开分组，进入末尾的“隐藏”说明，并带有指向
 * 需要开启的卡片的链接；在搜索中它会显示为紧凑提示，
 * 以便搜索能找到所有存在的内容。
 */
import type { CardDef, GroupKey } from '../types';
import { firstOff, getBool, noteInteraction, registerDeps, saveState, toList, trans } from '../util';
import { AdminCard, lockReason } from './AdminCard';

const KEY = 'lcoy-roselle.admin.settings';
const SHELL = `${KEY}.shell`;

export interface GroupDef {
  key: GroupKey;
  icon: string;
  label: () => string;
  description: () => string;
  /** 不常使用的分组：仅在“更多设置”打开时显示。 */
  advanced?: boolean;
}

export const GROUPS: GroupDef[] = [
  {
    key: 'appearance',
    icon: 'fas fa-palette',
    label: () => trans(`${KEY}.group_appearance`, '外观'),
    description: () => trans(`${SHELL}.group_appearance_desc`, '颜色、字体、表面、按钮、图标与提示条。'),
  },
  {
    key: 'navigation',
    icon: 'fas fa-table-columns',
    label: () => trans(`${SHELL}.group_navigation`, '页头与侧栏'),
    description: () => trans(`${SHELL}.group_navigation_desc`, '页头搜索与菜单、登录、键盘快捷键，以及 Discourse 风格的侧栏。'),
  },
  {
    key: 'list',
    icon: 'fas fa-list',
    label: () => trans(`${KEY}.group_list`, '讨论列表'),
    description: () => trans(`${SHELL}.group_list_desc`, '讨论列表的首页、选项卡、列、标签与计数。'),
  },
  {
    key: 'topic',
    icon: 'far fa-comments',
    label: () => trans(`${KEY}.group_topic`, '讨论'),
    description: () => trans(`${SHELL}.group_topic_desc`, '帖子、时间线、主题信息、页脚与阅读功能。'),
  },
  {
    key: 'composer',
    icon: 'fas fa-pen-to-square',
    label: () => trans(`${KEY}.group_composer`, '编辑器与搜索'),
    description: () => trans(`${SHELL}.group_composer_desc`, 'Discourse 风格的编辑器、草稿、#标签与高级搜索。'),
  },
  {
    key: 'people',
    icon: 'far fa-user',
    label: () => trans(`${SHELL}.group_people`, '个人主页与用户'),
    description: () => trans(`${SHELL}.group_people_desc`, '个人主页、用户卡片、扩展字段与活动。'),
  },
  {
    key: 'community',
    icon: 'fas fa-users',
    label: () => trans(`${KEY}.group_community`, '社区'),
    description: () => trans(`${SHELL}.group_community_desc`, '关于、社区准则、用户与用户组。'),
  },
  {
    key: 'moderation',
    icon: 'fas fa-shield-halved',
    label: () => trans(`${SHELL}.group_moderation`, '审核'),
    description: () => trans(`${SHELL}.group_moderation_desc`, '管理工具：批量操作、编辑历史，以及给作者的提示。'),
    advanced: true,
  },
  {
    key: 'integrations',
    icon: 'fas fa-puzzle-piece',
    label: () => trans(`${SHELL}.group_integrations`, '集成'),
    description: () => trans(`${SHELL}.group_integrations_desc`, '为第三方扩展套用 Discourse 外观。每项都只有在启用对应扩展后才会生效。'),
    advanced: true,
  },
];

const TAB_STORAGE_KEY = 'lcoy.admin.tab';

export function createPanel(cards: CardDef[]): any {
  // 每个主开关的要求：这样指向它的 `dependsOn` 会
  // 以级联方式继承它的依赖。
  for (const card of cards) {
    if (card.master) registerDeps(card.master, { deps: toList(card.dependsOn), extensions: card.extensions ?? [], locked: card.lockedBy });
  }

  const groupLabel = (key: GroupKey) => GROUPS.find((group) => group.key === key)?.label() ?? '';

  /** 主开关为 `key` 的卡片——“依赖于……”的目标。 */
  const ownerOf = (key: string): CardDef | undefined => cards.find((card) => card.master === key);

  const depTitle = (key: string): string => ownerOf(key)?.title() ?? key;

  let activeGroup: GroupKey = (() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY) as GroupKey | null;
      if (saved && GROUPS.some((group) => group.key === saved)) return saved;
    } catch {
      // localStorage 被禁用：继续停留在第一个分组。
    }
    return 'appearance';
  })();

  let query = '';

  // 不常使用的分组藏在“更多设置”后面。如果上次打开的
  // 分组是其中之一，面板会直接带着它们显示。
  let showAdvanced = !!GROUPS.find((group) => group.key === activeGroup)?.advanced;

  const setGroup = (key: GroupKey) => {
    activeGroup = key;
    query = '';
    try {
      localStorage.setItem(TAB_STORAGE_KEY, key);
    } catch {
      // 没有持久化只是少了一点便利。
    }
  };

  /** 跳转到卡片（必要时切换分组），并短暂高亮它。 */
  const jumpTo = (target: CardDef | undefined) => {
    // 如果待开启的卡片也被隐藏，沿依赖链向上找到
    // 第一个可见的卡片。
    let card = target;
    for (let dep = card && firstOff(card.dependsOn); card && dep; dep = card && firstOff(card.dependsOn)) card = ownerOf(dep);
    if (!card) return;
    setGroup(card.group);
    m.redraw.sync();

    const element = document.getElementById(`LcoyAdmin-card-${card.id}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.setAttribute('data-flash', '1');
    setTimeout(() => element.removeAttribute('data-flash'), 1600);
  };

  // 在手机上分组会变成可横向滚动的条：当前项需要处于
  // 可见范围。仅在分组变化时滚动，而不是每次重绘。
  let revealed: GroupKey | null = null;
  const revealActive = (nav: HTMLElement) => {
    if (revealed === activeGroup) return;
    revealed = activeGroup;
    const item = nav.querySelector('.is-active') as HTMLElement | null;
    if (item && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = item.offsetLeft - nav.offsetLeft - 16;
  };

  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const matches = (card: CardDef, needle: string): boolean =>
    normalize(`${card.title()} ${card.description?.() ?? ''} ${card.keywords} ${groupLabel(card.group)}`).includes(needle);

  const featureCount = (key: GroupKey) => {
    // 仅统计可见功能：因依赖而隐藏的卡片不计入总数。
    const features = cards.filter((card) => card.group === key && card.master && !firstOff(card.dependsOn));
    const active = features.filter((card) => !lockReason(card) && getBool(card.master!));

    return { total: features.length, active: active.length };
  };

  const SaveIndicator: any = {
    view() {
      const { status } = saveState;
      const text =
        status === 'saving'
          ? trans(`${SHELL}.saving`, '正在保存…')
          : status === 'saved'
            ? trans(`${SHELL}.saved_all`, '更改已保存')
            : status === 'error'
              ? trans(`${SHELL}.save_error`, '无法保存')
              : trans(`${SHELL}.autosave`, '所有设置都会自动保存');
      const icon =
        status === 'saving'
          ? 'fas fa-circle-notch fa-spin'
          : status === 'error'
            ? 'fas fa-triangle-exclamation'
            : status === 'saved'
              ? 'fas fa-check'
              : 'fas fa-cloud';

      return (
        <span className={`LcoyAdmin-save is-${status}`} role="status" aria-live="polite">
          <i className={icon} aria-hidden="true" />
          {text}
        </span>
      );
    },
  };

  /** 依赖已关闭内容的卡片，在搜索中：提示与开启快捷入口。 */
  const HiddenStub: any = {
    view({ attrs: { card, dep } }: any) {
      return (
        <div className="LcoyAdmin-stub">
          <span className="LcoyAdmin-card-icon">
            <i className={card.icon} aria-hidden="true" />
          </span>
          <div className="LcoyAdmin-stub-text">
            <strong>{card.title()}</strong>
            <span className="LcoyAdmin-card-group">{groupLabel(card.group)}</span>
            <span className="LcoyAdmin-stub-reason">
              {trans(`${SHELL}.depends_on`, '依赖于「{name}」，而它当前已关闭。', { name: depTitle(dep) })}
            </span>
          </div>
          <button type="button" className="Button Button--text LcoyAdmin-stub-go" onclick={() => jumpTo(ownerOf(dep))}>
            {trans(`${SHELL}.go_enable`, '前往开启')} <i className="fas fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      );
    },
  };

  return {
    view() {
      const needle = normalize(query.trim());
      const searching = needle.length > 0;
      const group = GROUPS.find((g) => g.key === activeGroup) ?? GROUPS[0];
      const pool = searching ? cards.filter((card) => matches(card, needle)) : cards.filter((card) => card.group === group.key);
      const shown = pool.filter((card) => !firstOff(card.dependsOn));
      const hidden = pool.filter((card) => firstOff(card.dependsOn));
      const groups = GROUPS.filter((item) => !item.advanced || showAdvanced);

      return (
        <div
          className="LcoyAdmin"
          onpointerdown={(event: any) => {
            event.redraw = false;
            noteInteraction(event.target);
          }}
          onfocusin={(event: any) => {
            event.redraw = false;
            noteInteraction(event.target);
          }}
        >
          <aside className="LcoyAdmin-side">
            <div className="LcoyAdmin-search">
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                className="LcoyAdmin-searchInput"
                value={query}
                placeholder={trans(`${KEY}.search_placeholder`, '搜索设置…')}
                aria-label={trans(`${KEY}.search_placeholder`, '搜索设置…')}
                oninput={(event: InputEvent) => {
                  query = (event.target as HTMLInputElement).value;
                }}
              />
              {!!query && (
                <button
                  type="button"
                  className="LcoyAdmin-searchClear"
                  aria-label={trans(`${KEY}.search_clear`, '清除搜索')}
                  onclick={() => {
                    query = '';
                  }}
                >
                  <i className="fas fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>

            <nav
              className="LcoyAdmin-nav"
              aria-label={trans(`${KEY}.groups_aria`, '设置分组')}
              oncreate={(vnode: any) => revealActive(vnode.dom)}
              onupdate={(vnode: any) => revealActive(vnode.dom)}
            >
              {groups.map((g) => {
                const isActive = !searching && g.key === activeGroup;
                const count = featureCount(g.key);

                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    className={`LcoyAdmin-navItem${isActive ? ' is-active' : ''}`}
                    onclick={() => setGroup(g.key)}
                  >
                    <i className={g.icon} aria-hidden="true" />
                    <span className="LcoyAdmin-navLabel">{g.label()}</span>
                    {count.total > 0 && (
                      <span
                        className="LcoyAdmin-navCount"
                        title={trans(`${SHELL}.active_count`, '{active} 项功能已开启，共 {total} 项', { active: count.active, total: count.total })}
                      >
                        {count.active}/{count.total}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                className="LcoyAdmin-navItem LcoyAdmin-navMore"
                aria-expanded={showAdvanced ? 'true' : 'false'}
                onclick={() => {
                  showAdvanced = !showAdvanced;
                  if (!showAdvanced && GROUPS.find((g) => g.key === activeGroup)?.advanced) setGroup('appearance');
                }}
              >
                <i className={showAdvanced ? 'fas fa-chevron-up' : 'fas fa-ellipsis'} aria-hidden="true" />
                <span className="LcoyAdmin-navLabel">
                  {showAdvanced ? trans(`${SHELL}.fewer_groups`, '收起设置') : trans(`${SHELL}.more_groups`, '更多设置')}
                </span>
              </button>
            </nav>
          </aside>

          <div className="LcoyAdmin-main">
            <div className="LcoyAdmin-head">
              <div className="LcoyAdmin-headText">
                <h2 className="LcoyAdmin-headTitle">
                  {searching ? (
                    trans(`${SHELL}.search_results`, '「{query}」的搜索结果', { query: query.trim() })
                  ) : (
                    <>
                      <i className={group.icon} aria-hidden="true" />
                      {group.label()}
                    </>
                  )}
                </h2>
                {!searching && <p className="LcoyAdmin-headDesc">{group.description()}</p>}
              </div>
              <SaveIndicator />
            </div>

            {pool.length === 0 ? (
              <p className="LcoyAdmin-empty">{trans(`${KEY}.search_empty`, '未找到设置。')}</p>
            ) : (
              <div className="LcoyAdmin-cards">
                {shown.map((card) => (
                  <AdminCard key={card.id} card={card} groupLabel={searching ? groupLabel(card.group) : undefined} />
                ))}
                {searching && hidden.map((card) => <HiddenStub key={`stub-${card.id}`} card={card} dep={firstOff(card.dependsOn)} />)}
              </div>
            )}

            {!searching && hidden.length > 0 && (
              <div className="LcoyAdmin-hidden">
                <p className="LcoyAdmin-hidden-title">
                  <i className="far fa-eye-slash" aria-hidden="true" />
                  {trans(`${SHELL}.hidden_title`, '因依赖的项目已关闭而被隐藏')}
                </p>
                <ul>
                  {hidden.map((card) => {
                    const dep = firstOff(card.dependsOn)!;

                    return (
                      <li key={card.id}>
                        <span>
                          <i className={card.icon} aria-hidden="true" /> {card.title()}
                        </span>
                        <button type="button" className="LcoyAdmin-hidden-link" onclick={() => jumpTo(ownerOf(dep))}>
                          {trans(`${SHELL}.needs`, '需要「{name}」', { name: depTitle(dep) })}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    },
  };
}
