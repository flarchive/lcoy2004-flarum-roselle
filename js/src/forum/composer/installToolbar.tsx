/*
 * Discourse 编辑器的格式工具栏（`.d-editor-button-bar`）：
 *
 *   [M↓|A]  N  I  Tт  🔗  "  <>  ⬆  ☰  1.  ⇆  ☺  ⊕   ›
 *
 * - Markdown/"A" 切换器（`composer-toggle-switch`）：Markdown 以全宽
 *   打开编辑器并在侧边显示预览；"A" 则保持窄幅、
 *   不带预览（见 `richMode`）。
 * - 加粗和标题使用字母（"N"、"Tт"），引号使用闭合引号。
 * - ⬆ 是 fof/upload 的上传（它放在页脚），被移到代码之后；
 *   拖放和粘贴图片仍由它负责。
 * - ⇆ 切换文本方向（`toggle-direction`）。
 * - ⊕（`options`）汇集 Discourse 不在栏中显示的内容：删除线、
 *   剧透、按地址插入图片、提及以及 fof/polls 的投票。
 * - 栏放不下并可滚动时，会出现 "›"。
 *
 * 全部内容都在扩展之后进入第一个编辑器：flarum/markdown 通过
 * `override` 组装该栏，之前注册的 `extend` 会被丢弃。
 * 适用于任何带编辑器的 TextEditor（私信编辑器也一样）。
 */
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import TextEditor from 'flarum/common/components/TextEditor';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import extractText from 'flarum/common/utils/extractText';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { editorComposer } from '../features/composer/common';
import { t } from '../utils/settings';

export interface MoreAction {
  icon: string;
  label: string;
  onclick: (e?: MouseEvent) => void;
  active?: boolean;
}

const MODE_KEY = 'lcoy.composerEditor';
let memoryMode: 'rich' | 'markdown' = 'rich';

/**
 * Discourse "M↓ | A" 切换器的两种模式，记录在浏览器中：
 * - "A"（默认）：窄幅编辑器，与主题同宽，不带侧边预览，
 *   角落只有全屏/最小化/关闭。Flarum 没有富文本
 *   编辑器；文本仍在同一字段中书写。
 * - Markdown：全宽，侧边显示预览（角落的 « 可隐藏它）。
 */
export function richMode(): boolean {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === null ? true : value === 'rich';
  } catch {
    return memoryMode === 'rich';
  }
}

/** 字段的占位文本按模式变化，以便无需重新打开即可切换。 */
let placeholderFor: (rich: boolean) => string = () => '';

export function setPlaceholderProvider(provider: (rich: boolean) => string): void {
  placeholderFor = provider;
}

export function setRichMode(value: boolean): void {
  memoryMode = value ? 'rich' : 'markdown';

  try {
    localStorage.setItem(MODE_KEY, memoryMode);
  } catch {
    // 保持到离开页面为止。
  }

  const textarea = document.querySelector('.Composer .TextEditor-editor') as HTMLTextAreaElement | null;
  const placeholder = placeholderFor(value);
  if (textarea && placeholder) textarea.placeholder = placeholder;

  m.redraw();
}

/**
 * 来自编辑器外部的额外操作（fof/polls 的投票位于编辑器的
 * 页眉中）。注册者在不再适用时返回 `null`。
 */
const externalActions: Array<() => (MoreAction & { key: string }) | null> = [];

export function addMoreAction(provider: () => (MoreAction & { key: string }) | null): void {
  externalActions.push(provider);
}

/** Markdown / "A" 切换器。 */
class RichToggle extends Component {
  view(): Mithril.Children {
    const rich = richMode();
    const label = rich ? t('composer.shell.switch_to_markdown') : t('composer.shell.switch_to_rich');

    return (
      <button
        type="button"
        className={`LcoyRichToggle ${rich ? '--rte' : '--markdown'}`}
        role="switch"
        aria-checked={rich ? 'true' : 'false'}
        aria-label={label}
        title={label}
        onclick={() => setRichMode(!rich)}
      >
        <span className="LcoyRichToggle-slider">
          <span className="LcoyRichToggle-left" aria-hidden="true">
            <Icon name="fab fa-markdown" />
          </span>
          <span className="LcoyRichToggle-right" aria-hidden="true">
            A
          </span>
        </span>
      </button>
    );
  }
}

/** ⊕ 菜单：向上打开，固定在屏幕上，位于工具栏之外（工具栏会滚动并裁剪它）。 */
class MoreMenu extends Component<{ actions: () => MoreAction[] }> {
  private portal: HTMLElement | null = null;
  private outside: ((e: MouseEvent) => void) | null = null;

  view(): Mithril.Children {
    const label = t('composer.shell.more_options');

    return (
      <Button
        className="Button Button--icon Button--link LcoyMoreOptions"
        icon="fas fa-circle-plus"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        onclick={(e: MouseEvent) => this.toggle(e)}
      />
    );
  }

  toggle(e: MouseEvent): void {
    if (this.portal) return this.close();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const portal = document.createElement('div');

    portal.className = 'LcoyMoreOptions-portal';
    portal.style.left = `${Math.max(8, rect.left)}px`;
    portal.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    document.body.appendChild(portal);
    this.portal = portal;

    const render = () =>
      m.render(
        portal,
        <ul className="Dropdown-menu LcoyMoreOptions-menu" role="menu">
          {this.attrs.actions().map((action) => (
            <li>
              <button
                type="button"
                className={`LcoyMoreOptions-item${action.active ? ' active' : ''}`}
                role="menuitem"
                onclick={(event: MouseEvent) => {
                  this.close();
                  action.onclick(event);
                  m.redraw();
                }}
              >
                <Icon name={action.icon} />
                <span>{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      );

    render();

    this.outside = (event: MouseEvent) => {
      if (!portal.contains(event.target as Node) && !this.element.contains(event.target as Node)) this.close();
    };
    setTimeout(() => this.outside && document.addEventListener('mousedown', this.outside));
  }

  close(): void {
    if (this.outside) document.removeEventListener('mousedown', this.outside);
    this.outside = null;

    if (this.portal) {
      m.render(this.portal, null);
      this.portal.remove();
      this.portal = null;
    }
  }

  onremove(vnode: Mithril.VnodeDOM): void {
    super.onremove(vnode as any);
    this.close();
  }
}

/**
 * "‹" 和 "›"：仅在工具栏放不下且该方向还有内容可滚动时
 * 出现；每次滚动工具栏 160px。
 */
class ScrollButton extends Component<{ dir: 'left' | 'right' }> {
  view(): Mithril.Children {
    const left = this.attrs.dir === 'left';

    return (
      <button
        type="button"
        className={`LcoyToolbarScroll LcoyToolbarScroll--${this.attrs.dir}`}
        aria-hidden="true"
        tabindex={-1}
        onclick={() => this.bar()?.scrollBy({ left: left ? -160 : 160, behavior: 'smooth' })}
      >
        <Icon name={left ? 'fas fa-chevron-left' : 'fas fa-chevron-right'} />
      </button>
    );
  }

  bar(): HTMLElement | null {
    return this.element?.closest('.TextEditor-toolbar') as HTMLElement | null;
  }

  oncreate(vnode: Mithril.VnodeDOM): void {
    super.oncreate(vnode as any);

    const bar = this.bar();
    const update = () => {
      if (!bar) return;
      const overflow = bar.scrollWidth - bar.clientWidth > 2;
      const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 2;
      bar.classList.toggle('has-overflow', overflow && !atEnd);
      bar.classList.toggle('has-overflow-left', overflow && bar.scrollLeft > 2);
    };

    bar?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    (this as any).lcoyUpdate = update;
    update();
  }

  onupdate(vnode: Mithril.VnodeDOM): void {
    super.onupdate(vnode as any);
    (this as any).lcoyUpdate?.();
  }

  onremove(vnode: Mithril.VnodeDOM): void {
    super.onremove(vnode as any);
    window.removeEventListener('resize', (this as any).lcoyUpdate);
  }
}

function fromVnode(vnode: any, fallbackLabel = ''): MoreAction | null {
  const attrs = vnode?.attrs;
  if (!attrs || typeof attrs.onclick !== 'function') return null;

  const label = attrs.title || attrs.tooltipText || attrs['aria-label'] || extractText(vnode.children) || fallbackLabel;

  return { icon: attrs.icon || 'fas fa-circle', label: String(label).replace(/\s*<[^>]+>\s*$/, ''), onclick: attrs.onclick };
}

export default function installToolbar() {
  const ORDER: Record<string, number> = {
    bold: 1000,
    italic: 990,
    header: 980,
    link: 900,
    quote: 890,
    code: 880,
    unordered_list: 800,
    ordered_list: 790,
  };

  const MOVED_TO_MORE = ['strikethrough', 'spoiler', 'image'];
  const UPLOAD_KEYS = ['fof-upload', 'fof-upload-media'];

  let applied = false;

  extend(TextEditor.prototype, 'oninit', function () {
    if (applied) return;
    applied = true;

    // 加粗的字母来自翻译（葡萄牙语为 "N"，英语为 "B"）。
    document.documentElement.style.setProperty('--lcoy-bold-label', JSON.stringify(t('composer.shell.bold_label')));

    // 1) 页脚：上传从控件中移出，进入工具栏。
    extend(TextEditor.prototype, 'controlItems', function (this: any, items: ItemList<Mithril.Children>) {
      if (!editorComposer(this)) return;

      this.lcoyMore = [] as Array<MoreAction & { key: string }>;
      this.lcoyUploads = UPLOAD_KEYS.filter((key) => items.has(key)).map((key) => ({ key, vnode: items.get(key) }));
      this.lcoyUploadsPlaced = false;
      this.lcoyUploads.forEach(({ key }: { key: string }) => items.remove(key));
    });

    // 2) Markdown 按钮：Discourse 的顺序、字母，以及 ⊕ 的额外项。
    extend(TextEditor.prototype as any, 'markdownToolbarItems', function (this: any, items: ItemList<any>) {
      if (!editorComposer(this)) return;

      Object.entries(ORDER).forEach(([key, priority]) => {
        if (items.has(key)) items.setPriority(key, priority);
      });

      const set = (key: string, icon: string) => {
        const vnode = items.has(key) ? items.get(key) : null;
        if (vnode?.attrs) vnode.attrs.icon = icon;
      };

      set('bold', 'LcoyTextIcon LcoyTextIcon--bold');
      set('header', 'LcoyTextIcon LcoyTextIcon--heading');
      set('quote', 'fas fa-quote-right');

      MOVED_TO_MORE.forEach((key) => {
        if (!items.has(key)) return;
        const action = fromVnode(items.get(key));
        if (action) (this.lcoyMore ||= []).push({ key, ...action });
        items.remove(key);
      });

      (this.lcoyUploads || []).forEach(({ key, vnode }: { key: string; vnode: Mithril.Children }) => items.add(key, vnode, 870));
      this.lcoyUploadsPlaced = true;

      items.add(
        'lcoyDirection',
        <Button
          className="Button Button--icon Button--link LcoyDirection"
          icon="fas fa-right-left"
          title={t('composer.shell.toggle_direction')}
          aria-label={t('composer.shell.toggle_direction')}
          onclick={() => {
            const textarea = this.element?.querySelector('textarea') as HTMLTextAreaElement | null;
            if (textarea) textarea.dir = textarea.dir === 'rtl' ? 'ltr' : 'rtl';
          }}
        />,
        780
      );
    });

    // 3) 整个工具栏：切换器、给 ⊕ 的提及项、⊕ 本身以及 "›"。
    extend(TextEditor.prototype, 'toolbarItems', function (this: any, items: ItemList<Mithril.Children>) {
      if (!editorComposer(this)) return;

      // 没有 flarum/markdown 时，上传仍然放在工具栏中。
      if (!this.lcoyUploadsPlaced)
        (this.lcoyUploads || []).forEach(({ key, vnode }: { key: string; vnode: Mithril.Children }) => items.add(key, vnode, 90));

      items.add('lcoyRich', <RichToggle />, 10000);

      if (items.has('mention')) {
        const action = fromVnode(items.get('mention'));
        if (action) (this.lcoyMore ||= []).push({ key: 'mention', ...action });
        items.remove('mention');
      }

      const editor = this;
      const actions = (): MoreAction[] => [
        ...externalActions.map((provider) => provider()).filter((action): action is MoreAction & { key: string } => !!action),
        ...(editor.lcoyMore || []),
      ];

      if (actions().length) items.add('lcoyMore', <MoreMenu actions={actions} />, -1000);
      items.add('lcoyScrollBack', <ScrollButton dir="left" />, 2000);
      items.add('lcoyScroll', <ScrollButton dir="right" />, -2000);
    });
  });
}
