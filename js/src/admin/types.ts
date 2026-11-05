/*
 * Admin 面板的类型，单独放在一个文件中，以便带后端的
 * 功能（./features/*）声明各自的卡片而无需导入 index。
 */
export type GroupKey = 'appearance' | 'navigation' | 'list' | 'topic' | 'composer' | 'people' | 'community' | 'moderation' | 'integrations';

export interface CardDef {
  /** 稳定标识符：卡片的锚点、Mithril 的键以及“依赖”链接的目标。 */
  id: string;
  group: GroupKey;
  icon: string;
  title: () => string;
  /** 功能的作用，位于标题下方——功能关闭时仍然可见。 */
  description?: () => string;
  /** 搜索的额外关键词——查找该卡片时会输入的内容。 */
  keywords: string;
  /**
   * 功能的开关，绘制在卡片标题栏中。关闭时，
   * 整个内容消失（不是仅被禁用），依赖它的卡片和选项
   * 也会消失。
   */
  master?: string;
  /**
   * 卡片存在所必须开启的键——通常是另一张卡片的
   * `master`。缺少它们时卡片会从组中消失（只出现在
   * 末尾的“隐藏”说明中，并带有需要开启内容的链接）。
   */
  dependsOn?: string | string[];
  /**
   * 功能运行所必需的扩展（Flarum 的 id，例如
   * `fof-drafts`）。缺少它们时卡片仍然可见但被锁定，
   * 并显示“需要扩展 X”。
   */
  extensions?: string[];
  /** 锁定卡片的其他原因（后端未加载、提供方没有密钥……），或 `null`。 */
  lockedBy?: () => string | null;
  /** 内容区；仅在只有标题栏开关的卡片中省略。 */
  body?: () => any;
}
