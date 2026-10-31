/*
 * #分类 与 #标签，与 Discourse 一致。
 *
 * 在编辑器中：输入 `#` 会建议标签（带分类的彩色符号），并插入
 * Markdown 链接 `[#name](标签地址)`。当 flarum/mentions 和
 * flarum/tags 启用时，`#` 已归它管理——它会建议标签并写入标签
 * 提及——主题不会在同一触发符上打开第二个菜单。
 *
 * 在帖子中：指向文本以 `#` 开头的标签的链接（主题自带的）以及
 * flarum/mentions 的标签提及，会变成 Discourse 的 hashtag 胶囊，
 * 带分类符号或标签图标。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import Icon from 'flarum/common/components/Icon';
import CommentPost from 'flarum/forum/components/CommentPost';
import highlight from 'flarum/common/helpers/highlight';

import Autocomplete from './Autocomplete';
import { composerOn } from './common';
import { allTags, categorySymbol, isTagsEnabled, sortTags, tagUrl, type LcoyTag } from '../../utils/tags';
import { isExtensionEnabled, t } from '../../utils/settings';
import { iconMarkup } from '../../icons';

declare const s9e: { TextFormatter: { preview: (text: string, element: HTMLElement) => void } } | undefined;

const SUGGESTION_LIMIT = 8;

/** 忽略重音和大小写的搜索，与用户的输入方式一致。 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** 两个扩展均启用时，`#` 已由 flarum/mentions 处理。 */
function mentionsOwnsHash(): boolean {
  return isExtensionEnabled('flarum-mentions') && isTagsEnabled();
}

function absoluteUrl(path: string): string {
  const origin = app.forum.attribute<string>('baseOrigin') || window.location.origin;

  return /^https?:\/\//.test(path) ? path : origin + path;
}

function suggestTags(typed: string): LcoyTag[] {
  const query = normalize(typed);
  const visible = allTags();
  const starts = (tag: LcoyTag) => normalize(tag.name()).startsWith(query) || tag.slug().startsWith(query);
  const contains = (tag: LcoyTag) => normalize(tag.name()).includes(query);

  // 分类先于标签，以输入内容开头的项先于仅包含它的项
  // ——即 Discourse 的建议顺序。
  const ranked = [...sortTags(visible.filter(starts)), ...sortTags(visible.filter((tag) => !starts(tag) && contains(tag)))];

  return ranked.slice(0, SUGGESTION_LIMIT);
}

export default function installHashtags() {
  extend(TextEditor.prototype as any, 'buildEditorParams', function (this: TextEditor, params: any) {
    if (!composerOn('Hashtags') || !isTagsEnabled() || mentionsOwnsHash()) return;

    const autocomplete = new Autocomplete(this, {
      className: 'LcoyAutocomplete--hashtag',
      trigger: '#',
      validBit: /[-_\p{L}\p{N}\p{M}]/u,
      suggest: (typed) =>
        suggestTags(typed).map((tag) => {
          const parent = tag.isChild() ? (tag.parent() as LcoyTag | null) : null;

          return {
            key: tag.id() || tag.slug(),
            replacement: `[#${tag.name()}](${absoluteUrl(tagUrl(tag))})`,
            label: (
              <>
                {tag.position() !== null ? categorySymbol(tag) : <Icon name="fas fa-tag" className="LcoyHashtag-tagIcon" />}
                <span className="LcoyAutocomplete-label">{typed ? highlight(tag.name(), typed) : tag.name()}</span>
                {parent && <span className="LcoyAutocomplete-meta">{parent.name()}</span>}
              </>
            ),
          };
        }),
      header: () => t('composer.hashtags.autocomplete_header'),
    });

    (this as any).lcoyHashtagAutocomplete = autocomplete;
    params.inputListeners.push(autocomplete.listener);
  });

  extend(TextEditor.prototype as any, 'onbuild', function (this: TextEditor) {
    (this as any).lcoyHashtagAutocomplete?.attach();
  });

  // 帖子内容是服务端返回的现成 HTML：胶囊在内容进入 DOM 之后插入，
  // 并在每次更新（编辑、实时刷新）时再次插入。
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: CommentPost) {
    if (!composerOn('Hashtags')) return;

    // 打开编辑器等操作会让所有帖子重绘；内容没变时不必重复扫描 DOM。
    const post = this.attrs.post;
    const signature = `${post.id()}:${String(post.contentHtml() ?? '').length}:${String(post.editedAt?.()?.getTime?.() ?? '')}`;

    if ((this as any).lcoyHashtagsFor === signature) return;
    (this as any).lcoyHashtagsFor = signature;

    const body = this.element?.querySelector<HTMLElement>('.Post-body');

    if (body) decorateHashtags(body);
  });

  // composer 的预览由 JS 格式化器在每次变更时绘制。
  if (typeof s9e !== 'undefined' && s9e?.TextFormatter) {
    override(s9e.TextFormatter as any, 'preview', function (original: any, ...args: any[]) {
      const [text, element] = args as [string, HTMLElement];

      original(text, element);

      if (composerOn('Hashtags')) decorateHashtags(element);
    });
  }
}

/** 链接对应的标签，取自地址末尾的 slug `/t/<slug>`。 */
function tagFromHref(href: string): LcoyTag | null {
  const match = /\/t\/([^/?#]+)\/?(?:[?#].*)?$/.exec(href);

  if (!match) return null;

  const slug = decodeURIComponent(match[1]).toLowerCase();

  return allTags().find((tag) => tag.slug().toLowerCase() === slug) || null;
}

export function decorateHashtags(root: HTMLElement): void {
  if (!isTagsEnabled()) return;

  root.querySelectorAll<HTMLAnchorElement>('a.TagMention, a[href*="/t/"]').forEach((link) => {
    if (link.dataset.lcoyHashtag) return;

    const isMention = link.classList.contains('TagMention');

    // 指向 /t/ 的普通链接只有指向本论坛时才计入：其他站点上的
    // 相同 slug 属于另一个标签。
    if (!isMention && (link.origin !== window.location.origin || !(link.textContent || '').trim().startsWith('#'))) return;

    const tag = tagFromHref(link.getAttribute('href') || '');

    if (!tag) return;

    link.dataset.lcoyHashtag = '1';
    link.classList.add('LcoyHashtag', tag.position() !== null ? 'LcoyHashtag--category' : 'LcoyHashtag--tag');

    // 名称不带 “#”：在 Discourse 中该符号由符号元素承担。
    const label = document.createElement('span');
    label.className = 'LcoyHashtag-name';
    label.textContent = tag.name();

    const symbol = document.createElement('span');
    symbol.className = 'LcoyHashtag-symbol';

    if (tag.position() !== null) {
      m.render(symbol, categorySymbol(tag));
    } else {
      symbol.innerHTML = iconMarkup('fas fa-tag');
    }

    link.replaceChildren(symbol, label);
    link.title ||= tag.description() || tag.name();
  });
}
