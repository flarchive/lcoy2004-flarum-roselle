/*
 * 在不依赖构建时 flarum/tags 的情况下访问标签。
 *
 * 主题在没有标签扩展时也能工作：没有它，模型中没有
 * `discussion.tags`，`app.currentTag` 也未定义。主题需要的少量信息
 * （名称、颜色、图标、层级）直接从模型读取，两种情况下
 * 模型都相同。
 */
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled } from './settings';

export interface LcoyTag {
  id(): string | undefined;
  name(): string;
  slug(): string;
  description(): string | null;
  color(): string | null;
  icon(): string | null;
  position(): number | null;
  isChild(): boolean;
  isHidden(): boolean;
  parent(): LcoyTag | false | null | undefined;
  children(): LcoyTag[] | false | undefined;
  discussionCount(): number;
  lastPostedAt(): Date | null | undefined;
  lastPostedDiscussion(): Discussion | false | null | undefined;
}

export function isTagsEnabled(): boolean {
  return isExtensionEnabled('flarum-tags');
}

export function allTags(): LcoyTag[] {
  return isTagsEnabled() ? (app.store.all('tags') as unknown as LcoyTag[]) : [];
}

/**
 * 与 flarum/tags 相同的顺序：主标签按位置，子标签紧跟在
 * 父标签之后，二级标签按名称。
 */
export function sortTags(tags: LcoyTag[]): LcoyTag[] {
  return tags.slice().sort((a, b) => {
    const aParent = a.isChild() ? (a.parent() as LcoyTag) : null;
    const bParent = b.isChild() ? (b.parent() as LcoyTag) : null;
    const aPos = a.position();
    const bPos = b.position();

    if (aParent && aParent === bParent) return (aPos ?? 0) - (bPos ?? 0);
    if (aParent && bParent) return (aParent.position() ?? 0) - (bParent.position() ?? 0);
    if (aParent) return aParent === b ? 1 : (aParent.position() ?? 0) - (bPos ?? 0);
    if (bParent) return bParent === a ? -1 : (aPos ?? 0) - (bParent.position() ?? 0);

    if (aPos === null && bPos === null) return b.discussionCount() - a.discussionCount();
    if (bPos === null) return -1;
    if (aPos === null) return 1;

    return aPos - bPos;
  });
}

/** Discourse 的“分类”：一级主标签。 */
export function primaryTags(): LcoyTag[] {
  return sortTags(allTags().filter((tag) => tag.position() !== null && !tag.isChild()));
}

/** Discourse 的“标签”：二级标签，最常用的在前。 */
export function secondaryTags(): LcoyTag[] {
  return allTags()
    .filter((tag) => tag.position() === null)
    .sort((a, b) => b.discussionCount() - a.discussionCount());
}

export function discussionTags(discussion: Discussion): LcoyTag[] {
  if (!isTagsEnabled()) return [];

  const tags = (discussion as any).tags?.();

  return Array.isArray(tags) ? sortTags(tags.filter(Boolean)) : [];
}

/** 像 Discourse 区分分类和标签那样拆分讨论的标签。 */
export function splitDiscussionTags(discussion: Discussion): { categories: LcoyTag[]; labels: LcoyTag[] } {
  const tags = discussionTags(discussion);

  return {
    categories: tags.filter((tag) => tag.position() !== null),
    labels: tags.filter((tag) => tag.position() === null),
  };
}

export function currentTag(): LcoyTag | null {
  if (!isTagsEnabled()) return null;

  return (app as any).currentTag?.() ?? null;
}

/**
 * 启用 Discourse 的地址后，/categories 是分类页，
 * /tags 是标签页；没有它们时，/tags（来自 flarum/tags）兼任两者。
 */
export function separateTagsPage(): boolean {
  return forumBool('lcoyListRoutes', false);
}

/** 分类页的路由。 */
export function categoriesRouteName(): string {
  return separateTagsPage() ? 'lcoy.categories' : 'tags';
}

export function categoriesUrl(): string {
  return app.route(categoriesRouteName());
}

export function tagUrl(tag: LcoyTag): string {
  return app.route('tag', { tags: tag.slug() });
}

/**
 * 像 Discourse 绘制的那样显示分类符号：使用其颜色的图标，或
 * 没有图标时，一个实心小方块。
 */
export function categorySymbol(tag: LcoyTag | null, className = ''): Mithril.Children {
  const color = tag?.color() || '';
  const icon = tag?.icon();

  return (
    <span
      className={classList('LcoyCategorySymbol', className, { 'LcoyCategorySymbol--square': !icon })}
      style={color ? { '--category-color': color } : undefined}
      aria-hidden="true"
    >
      {icon ? <Icon name={icon} /> : null}
    </span>
  );
}

/**
 * 没有图标的子标签的符号：双色小方块，父标签的颜色和
 * 它自己的颜色（`.badge-category.--has-parent::before`）。
 */
function childSymbol(tag: LcoyTag, parent: LcoyTag): Mithril.Children {
  const symbol: any = categorySymbol(tag);

  if (!tag.icon() && symbol?.attrs) {
    symbol.attrs.className = classList(symbol.attrs.className, 'LcoyCategorySymbol--split');
    symbol.attrs.style = { ...(symbol.attrs.style || {}), '--category-parent-color': parent.color() || 'var(--lcoy-primary-medium)' };
  }

  return symbol;
}

/**
 * “▪ 支持”——Discourse 的分类徽标，可带链接。有父标签时，
 * 变成子分类徽标：“▪ 支持 ▪ 安装”，只有一个链接
 * （指向子标签）。
 */
export function categoryBadge(tag: LcoyTag, link = true, parent: LcoyTag | null = null): Mithril.Children {
  const content = parent
    ? [
        categorySymbol(parent),
        <span className="LcoyCategoryBadge-name LcoyCategoryBadge-parent">{parent.name()}</span>,
        childSymbol(tag, parent),
        <span className="LcoyCategoryBadge-name">{tag.name()}</span>,
      ]
    : [categorySymbol(tag), <span className="LcoyCategoryBadge-name">{tag.name()}</span>];
  const attrs = { className: 'LcoyCategoryBadge', title: tag.description() || undefined };

  return link ? (
    <Link {...attrs} href={tagUrl(tag)}>
      {content}
    </Link>
  ) : (
    <span {...attrs}>{content}</span>
  );
}

/**
 * 按 Flarum 的定义显示标签图标（有颜色时使用其颜色）。
 * 没有图标时，使用 `fallback`（例如侧栏的通用标签）或什么都不显示。
 * 图标放在带 `--tag-color` 的 <span> 中，因为颜色由各处
 * CSS（列表、侧栏、搜索）应用，缺少颜色时由它们决定色调。
 */
export function tagSymbol(tag: LcoyTag | null, className = '', fallback: string | null = null): Mithril.Children {
  const icon = tag?.icon() || fallback;

  if (!icon) return null;

  const color = tag?.color() || '';

  return (
    <span
      className={classList('LcoyTagSymbol', className, { 'LcoyTagSymbol--colored': !!color })}
      style={color ? { '--tag-color': color } : undefined}
      aria-hidden="true"
    >
      <Icon name={icon} />
    </span>
  );
}

/** 采用 Discourse “simple” 样式的标签（二级标签）：有则显示 Flarum 的图标，以及文本。 */
export function labelBadge(tag: LcoyTag, link = true): Mithril.Children {
  const attrs = { className: 'LcoyTagBadge', title: tag.description() || undefined };
  const content = [tagSymbol(tag), <span>{tag.name()}</span>];

  return link ? (
    <Link {...attrs} href={tagUrl(tag)}>
      {content}
    </Link>
  ) : (
    <span {...attrs}>{content}</span>
  );
}

/** 分类后跟标签，位于标题下方一行。 */
export function discussionBadges(discussion: Discussion, link = true): Mithril.Children {
  const { categories, labels } = splitDiscussionTags(discussion);

  if (!categories.length && !labels.length) return null;

  // 父标签也在讨论中的子标签会变成一个“父 ▪ 子”徽标；
  // 父标签不会再单独显示。
  const childOf = (tag: LcoyTag): LcoyTag | null => {
    const parent = tag.isChild() ? (tag.parent() as LcoyTag | null | false) : null;

    return parent && categories.includes(parent) ? parent : null;
  };
  const parentsShown = new Set(categories.map(childOf).filter(Boolean));

  return (
    <span className="LcoyBadges">
      {categories.filter((tag) => !parentsShown.has(tag)).map((tag) => categoryBadge(tag, link, childOf(tag)))}
      {labels.length > 0 && <span className="LcoyBadges-labels">{labels.map((tag) => labelBadge(tag, link))}</span>}
    </span>
  );
}
