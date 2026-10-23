/*
 * Admin 主题面板的辅助函数：带兜底的翻译、配置读取
 * （核心以字符串形式保存）、保存每一项的 POST（带有
 * 面板显示的“保存中…/已保存”状态）以及键之间的
 * 依赖关系注册。
 */
import app from 'flarum/admin/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

/** 控件接收自由格式的 attrs（settingKey、label、help……）。 */
export type LooseAttrs = ComponentAttrs & Record<string, any>;

export abstract class AdminComponent<A extends LooseAttrs = LooseAttrs> extends Component<A> {}

export const settings = (): Record<string, any> => (app.data as any).settings;

export const trans = (key: string, fallback: string, params: Record<string, any> = {}): string => {
  // `extract: true` 让 Translator 返回字符串，而不是 Mithril 的子节点。
  //
  // try/catch 是必需的：当社区翻译带有不匹配的标签时，
  // ICU formatter 会抛出 SyntaxError，而单个损坏的字符串
  // 会导致整个设置页面崩溃。
  try {
    const translated = app.translator?.trans(key, params, true);
    if (typeof translated === 'string' && translated !== key) return translated;
  } catch (error) {
    console.warn(`[lcoy] 键 "${key}" 的翻译无效；使用默认文本。`, error);
  }

  return Object.entries(params).reduce<string>((text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)), fallback);
};

export const getBool = (key: string): boolean => {
  const value = settings()[key];

  return value === true || value === 'true' || value === '1' || value === 1;
};

export const getStr = (key: string, fallback = ''): string => String(settings()[key] ?? fallback);

// ─────────────────────────────────────────────────────────────────────────────
// 保存 + “已保存”
// ─────────────────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 保存状态，由面板栏上的指示器读取。 */
export const saveState: { status: SaveStatus; pending: number } = { status: 'idle', pending: 0 };

let idleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * 用户最后操作的卡片（点击或聚焦）。“已保存”会显示在
 * 那张卡片上，而无需每个控件知道自己位于哪张卡片：
 * 面板在 `pointerdown`/`focusin` 时记录卡片，
 * 保存完成时标记它。
 */
let lastCard: HTMLElement | null = null;

export const noteInteraction = (target: EventTarget | null): void => {
  const card = (target as HTMLElement | null)?.closest?.('.LcoyAdmin-card') as HTMLElement | null;
  if (card) lastCard = card;
};

const flashCard = (card: HTMLElement | null): void => {
  if (!card?.isConnected) return;

  // 使用数据属性而不是类：卡片状态变化时 Mithril 会重写
  // `className`，但不会碰它不认识的属性。
  card.setAttribute('data-saved', String(Date.now()));
  const stamp = card.getAttribute('data-saved');
  setTimeout(() => {
    if (card.getAttribute('data-saved') === stamp) card.removeAttribute('data-saved');
  }, 1800);
};

/** 直接写入 API——面板的所有控件都会自动保存。 */
export const saveSetting = (payload: Record<string, any>) => {
  const apiUrl = ((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '');
  const card = lastCard;

  clearTimeout(idleTimer);
  saveState.pending++;
  saveState.status = 'saving';
  m.redraw();

  return app.request({ method: 'POST', url: `${apiUrl}/settings`, body: payload }).then(
    (response) => {
      saveState.pending = Math.max(0, saveState.pending - 1);
      if (saveState.pending === 0 && saveState.status !== 'error') {
        saveState.status = 'saved';
        idleTimer = setTimeout(() => {
          saveState.status = 'idle';
          m.redraw();
        }, 2500);
      }
      flashCard(card);
      m.redraw();

      return response;
    },
    (error) => {
      saveState.pending = Math.max(0, saveState.pending - 1);
      saveState.status = 'error';
      m.redraw();

      throw error;
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 扩展
// ─────────────────────────────────────────────────────────────────────────────

/** 主题使用的扩展名称，用于扩展甚至未安装的情况。 */
const EXTENSION_NAMES: Record<string, string> = {
  'flarum-tags': 'Tags',
  'flarum-likes': 'Likes',
  'flarum-mentions': 'Mentions',
  'flarum-emoji': 'Emoji',
  'flarum-messages': 'Messages',
  'flarum-realtime': 'Realtime',
  'flarum-subscriptions': 'Subscriptions',
  'fof-drafts': 'FoF Drafts',
  'fof-reactions': 'FoF Reactions',
  'fof-best-answer': 'FoF Best Answer',
  'fof-polls': 'FoF Polls',
  'fof-links': 'FoF Links',
  'fof-upload': 'FoF Upload',
  'fof-discussion-thumbnail': 'FoF Discussion Thumbnail',
  'fof-formatting': 'FoF Formatting',
};

const installedExtension = (id: string): any => (app.data as any).extensions?.[id];

export const extensionName = (id: string): string => installedExtension(id)?.extra?.['flarum-extension']?.title || EXTENSION_NAMES[id] || id;

export const extensionInstalled = (id: string): boolean => !!installedExtension(id);

export const extensionOn = (id: string): boolean => isExtensionEnabled(id);

/** 列表中的第一个未启用（或未安装）的扩展。 */
export const missingExtension = (ids: string[] = []): string | null => ids.find((id) => !isExtensionEnabled(id)) ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// 键之间的依赖关系
// ─────────────────────────────────────────────────────────────────────────────

interface DepEntry {
  deps: string[];
  extensions: string[];
  locked?: () => string | null;
}

/**
 * 每个开关键生效所需的条件。卡片注册自己的
 * `master`（见 index.tsx）；控件在绘制时注册自己的条件。
 * 这样关闭侧边栏会级联清除所有依赖它的内容。
 */
const DEPS: Record<string, DepEntry> = {};

export const toList = (value?: string | string[]): string[] => (value ? (Array.isArray(value) ? value : [value]) : []);

export const registerDeps = (key: string, entry: Partial<DepEntry>): void => {
  const current = DEPS[key] ?? { deps: [], extensions: [] };
  DEPS[key] = {
    deps: [...new Set([...current.deps, ...(entry.deps ?? [])])],
    extensions: [...new Set([...current.extensions, ...(entry.extensions ?? [])])],
    locked: entry.locked ?? current.locked,
  };
};

/** 该键已开启，并且它所依赖的一切也都开启（递归）。 */
export const isOn = (key: string, seen: Set<string> = new Set()): boolean => {
  if (!getBool(key)) return false;
  if (seen.has(key)) return true;
  seen.add(key);

  const entry = DEPS[key];
  if (!entry) return true;
  if (missingExtension(entry.extensions)) return false;
  if (entry.locked?.()) return false;

  return entry.deps.every((dep) => isOn(dep, seen));
};

/** 列表中第一个未开启的依赖，或当所有依赖都成立时为 `null`。 */
export const firstOff = (deps?: string | string[]): string | null => toList(deps).find((dep) => !isOn(dep)) ?? null;

/** 仅当依赖成立时才绘制子元素——依赖已关闭内容的选项会消失。 */
export const when = (deps: string | string[], children: any): any => (firstOff(deps) ? null : children);
