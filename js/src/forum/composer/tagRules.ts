/*
 * flarum/tags 的标签选择规则，供主题自己的选择器使用
 * （编辑器中的 "主标签 | 二级标签" 一行、AI 建议、
 * 关联主题）。与 TagDiscussionModal 及服务端校验
 * （`DiscussionResourceFields`）相同：
 *
 * - 只纳入 `getSelectableTags` 中的标签：操作者可用来
 *   发起讨论的标签，或在编辑讨论时可添加到该讨论的标签
 *   （以及它已有的标签）；
 * - 子标签只有在父标签已选时有效（`requireParentTag`）；没有
 *   父标签时，其子标签一并移除；
 * - "主标签" 是一级主标签（`isPrimaryParent`）；子标签
 *   按服务端的方式计为二级标签；
 * - `flarum-tags.*` 的最小值和最大值（`minPrimaryTags` 等），
 *   拥有 "忽略标签要求" 权限（`canBypassTagCounts`）时可豁免
 *   下限，与核心弹窗允许无下限发布相同。
 *
 * 只要 flarum/tags 暴露了相应函数（`getSelectableTags`、`sortTags`），
 * 就使用它而不是这里的副本，以跟随其行为。
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';

import { allTags, isTagsEnabled, sortTags as themeSortTags, type LcoyTag } from '../utils/tags';

export type RuleTag = LcoyTag & {
  canStartDiscussion?: () => boolean;
  canAddToDiscussion?: () => boolean;
};

export interface TagLimits {
  minPrimary: number;
  maxPrimary: number;
  minSecondary: number;
  maxSecondary: number;
  /** "忽略标签要求"：豁免下限。 */
  bypass: boolean;
}

/** flarum/tags 迁移中的默认值，用于属性缺失时。 */
const DEFAULTS = { minPrimaryTags: 1, maxPrimaryTags: 1, minSecondaryTags: 0, maxSecondaryTags: 3 };

function setting(name: keyof typeof DEFAULTS): number {
  const value = parseInt(String(app.forum.attribute(name) ?? ''), 10);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULTS[name];
}

export function tagLimits(): TagLimits {
  return {
    minPrimary: setting('minPrimaryTags'),
    maxPrimary: setting('maxPrimaryTags'),
    minSecondary: setting('minSecondaryTags'),
    maxSecondary: setting('maxSecondaryTags'),
    bypass: !!app.forum.attribute('canBypassTagCounts'),
  };
}

/** 子标签的父标签（通过 `isChild` 属性，该属性总是存在）。 */
export function parentTag(tag: LcoyTag): LcoyTag | null {
  if (!tag.isChild()) return null;

  const parent = tag.parent();
  return parent ? parent : null;
}

/** 一级主标签：服务端唯一视为 "主标签" 的那种。 */
export function isPrimaryParent(tag: LcoyTag): boolean {
  return tag.position() !== null && tag.position() !== undefined && !tag.isChild();
}

function flarumTags(path: string): any {
  try {
    return isTagsEnabled() ? flarum.reg.get('flarum-tags', path) : null;
  } catch {
    return null;
  }
}

/** flarum/tags 的 `getSelectableTags`（带备用副本）。 */
export function selectableTags(discussion?: Discussion | null): RuleTag[] {
  if (!isTagsEnabled()) return [];

  const own = flarumTags('forum/utils/getSelectableTags');
  if (typeof own === 'function') return own(discussion || undefined) as RuleTag[];

  const tags = allTags() as RuleTag[];

  if (discussion) {
    const current = ((discussion as any).tags?.() || []) as RuleTag[];
    return tags.filter((tag) => tag.canAddToDiscussion?.() || current.includes(tag));
  }

  return tags.filter((tag) => !!tag.canStartDiscussion?.());
}

/** TagSelectionModal 的顺序（flarum/tags 的 `sortTags`）。 */
export function sortSelectable<T extends LcoyTag>(tags: T[]): T[] {
  const own = flarumTags('common/utils/sortTags');
  return (typeof own === 'function' ? own(tags) : themeSortTags(tags)) as T[];
}

export function countTags(selected: LcoyTag[]): { primary: number; secondary: number } {
  const primary = selected.filter(isPrimaryParent).length;
  return { primary, secondary: selected.length - primary };
}

/**
 * 移除 flarum/tags 不会接受的内容：重复项、父标签已移除的子标签，
 * 以及（若传入 `allowed`）不在其中的标签。
 */
export function normalizeTags<T extends LcoyTag>(selected: T[], allowed?: LcoyTag[]): T[] {
  const result: T[] = [];

  for (const tag of selected) {
    if (!tag || result.includes(tag)) continue;
    if (allowed && !allowed.includes(tag)) continue;
    result.push(tag);
  }

  return result.filter((tag) => {
    const parent = parentTag(tag);
    return !parent || result.includes(parent as T);
  });
}

/** 移除该标签，并与核心弹窗一样移除它的子标签。 */
export function removeTag<T extends LcoyTag>(selected: T[], tag: T): T[] {
  return selected.filter((item) => item !== tag && parentTag(item) !== tag);
}

/** 该类型的标签是否还能再加一个（上限对所有人都适用）。 */
export function hasRoomFor(tag: LcoyTag, selected: LcoyTag[], limits = tagLimits()): boolean {
  const { primary, secondary } = countTags(selected);

  return isPrimaryParent(tag) ? primary < limits.maxPrimary : secondary < limits.maxSecondary;
}

/**
 * 该标签现在能否加入：它在可选列表中、它的父标签（如果
 * 是子标签）已被选中，且该类型的上限尚未达到。
 */
export function canAddTag(tag: LcoyTag, selected: LcoyTag[], selectable: LcoyTag[] = selectableTags(), limits = tagLimits()): boolean {
  if (selected.includes(tag) || !selectable.includes(tag)) return false;

  const parent = parentTag(tag);
  if (parent && !selected.includes(parent)) return false;

  return hasRoomFor(tag, selected, limits);
}

/**
 * 按规则添加标签。被建议的子标签若没有父标签，会一并带上
 * 父标签（与弹窗的 `addTag` 相同），前提是父标签还有余量。无法添加时
 * 返回 `null`。
 */
export function addTag<T extends LcoyTag>(selected: T[], tag: T, selectable: LcoyTag[] = selectableTags(), limits = tagLimits()): T[] | null {
  const parent = parentTag(tag) as T | null;
  let base = selected;

  if (parent && !base.includes(parent)) {
    if (!canAddTag(parent, base, selectable, limits)) return null;
    base = base.concat(parent);
  }

  return canAddTag(tag, base, selectable, limits) ? base.concat(tag) : null;
}

/**
 * 发布前还缺什么，使用 flarum/tags 自己的文本；当选择满足下限
 * （或操作者可以忽略下限）时返回 `null`。
 */
export function missingTagsMessage(selected: LcoyTag[], limits = tagLimits()): { kind: 'primary' | 'secondary'; message: string } | null {
  if (limits.bypass) return null;

  const { primary, secondary } = countTags(selected);

  if (primary < limits.minPrimary) {
    return {
      kind: 'primary',
      message: app.translator.trans(
        'flarum-tags.lib.tag_selection_modal.choose_primary_placeholder',
        { count: limits.minPrimary - primary },
        true
      ) as string,
    };
  }

  if (secondary < limits.minSecondary) {
    return {
      kind: 'secondary',
      message: app.translator.trans(
        'flarum-tags.lib.tag_selection_modal.choose_secondary_placeholder',
        { count: limits.minSecondary - secondary },
        true
      ) as string,
    };
  }

  return null;
}
