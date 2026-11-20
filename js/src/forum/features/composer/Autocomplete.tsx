/*
 * 附着在编辑器光标处的建议菜单，类似 Discourse 为 `:emoji` 和
 * `#分类` 提供的菜单。
 *
 * 沿用 flarum/mentions 自动补全的设计（textarea 之后的一个容器，
 * 依据光标坐标计算位置，方向键/Enter/Tab/Esc 由 KeyboardNavigatable
 * 处理），但合并为单个类，由主题的两个触发入口复用。
 */
import KeyboardNavigatable from 'flarum/common/utils/KeyboardNavigatable';
import AutocompleteReader from 'flarum/common/utils/AutocompleteReader';
import classList from 'flarum/common/utils/classList';
import type TextEditor from 'flarum/common/components/TextEditor';
import type Mithril from 'mithril';

import { editorDriver } from './common';

export interface Suggestion {
  key: string;
  /** 菜单行中显示的内容。 */
  label: Mithril.Children;
  /** 替换触发符及已输入内容的文本。 */
  replacement: string;
}

export interface AutocompleteOptions {
  /** 菜单的额外类名，用于各触发入口的 CSS。 */
  className: string;
  trigger: string;
  /** 触发符之后可接受的字符（其余字符会结束建议）。 */
  validBit: RegExp;
  /** 在光标前查找触发符的字符数。 */
  lookBehind?: number;
  /** 菜单标题文本（若有）。 */
  header?: () => string;
  /** 针对已输入内容的建议；可为异步。 */
  suggest: (typed: string) => Suggestion[] | Promise<Suggestion[]>;
}

export default class Autocomplete {
  active = false;
  private index = 0;
  private items: Suggestion[] = [];
  private start = 0;
  private container: HTMLElement | null = null;
  private textarea: HTMLElement | null = null;
  private request = 0;

  constructor(
    private readonly editor: TextEditor,
    private readonly options: AutocompleteOptions
  ) {}

  /** 在编辑器的 `onbuild` 中调用：此时 textarea 已在 DOM 中。 */
  attach(): void {
    const textarea = this.editor.element?.querySelector<HTMLElement>('.TextEditor-editor');

    if (!textarea || !textarea.parentElement) return;

    this.textarea = textarea;
    this.container = document.createElement('div');
    this.container.className = 'LcoyAutocomplete-container';
    textarea.parentElement.style.position ||= 'relative';
    textarea.after(this.container);

    new KeyboardNavigatable()
      .when(() => this.active && this.items.length > 0)
      .onUp(() => this.move(-1))
      .onDown(() => this.move(1))
      .onSelect(() => this.choose(this.index))
      .onCancel(() => this.hide())
      .bindTo($(textarea));
  }

  /** 输入监听器，挂在 `params.inputListeners` 上。 */
  readonly listener = (): void => {
    const driver = editorDriver(this.editor);

    if (!driver || !this.container) return;

    const [cursor, end] = driver.getSelectionRange();

    if (end - cursor > 0) return this.hide();

    const reader = new AutocompleteReader(this.options.trigger);
    const found = reader.check(driver.getLastNChars(this.options.lookBehind ?? 30), cursor, this.options.validBit);

    if (!found) return this.hide();

    this.start = found.absoluteStart;

    const request = ++this.request;

    Promise.resolve(this.options.suggest(found.typed)).then((items) => {
      // 旧响应（来自 API 查询）不能覆盖此后已经输入的内容。
      if (request !== this.request) return;

      this.items = items;
      this.index = 0;

      if (items.length) this.show();
      else this.hide();
    });
  };

  private show(): void {
    if (!this.container) return;

    this.active = true;
    this.render();

    const driver = editorDriver(this.editor);
    const menu = this.container.firstElementChild as HTMLElement | null;

    if (!driver || !menu) return;

    // 与 flarum/mentions 相同的计算方式：位于光标下方，空间不足时
    // 位于上方，且不超出编辑器右边界。光标坐标相对于 textarea；
    // 容器位于其父元素的一角。
    const coordinates = driver.getCaretCoordinates(this.start);
    const parent = this.container.parentElement!;
    // 使用矩形而非 offsetTop：flarum/mentions 可能在容器创建后
    // 将 textarea 包裹进一个定位的 div。
    const textareaRect = this.textarea!.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    let top = textareaRect.top - parentRect.top + coordinates.top + 22;
    let left = textareaRect.left - parentRect.left + coordinates.left;

    if (top + menu.offsetHeight > parent.clientHeight) top = top - 22 - menu.offsetHeight - 6;
    if (left + menu.offsetWidth > parent.clientWidth) left = Math.max(0, parent.clientWidth - menu.offsetWidth);

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  hide(): void {
    this.request++;

    if (!this.active) return;

    this.active = false;
    this.items = [];

    if (this.container) m.render(this.container, null);
  }

  private move(delta: number): void {
    const count = this.items.length;

    this.index = (this.index + delta + count) % count;
    this.render();

    this.container?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  private choose(index: number): void {
    const item = this.items[index];
    const driver = editorDriver(this.editor);

    if (!item || !driver) return;

    // `start` 是触发符之后的位置；-1 使其也被纳入替换范围。
    driver.replaceBeforeCursor(this.start - 1, item.replacement + ' ', false);
    this.hide();
  }

  private render(): void {
    if (!this.container) return;

    const header = this.options.header?.();

    m.render(
      this.container,
      <ul className={classList('Dropdown-menu', 'LcoyAutocomplete', this.options.className)} role="listbox">
        {header && <li className="Dropdown-header">{header}</li>}
        {this.items.map((item, i) => (
          <li key={item.key} className={classList({ active: i === this.index })} role="option" aria-selected={i === this.index ? 'true' : 'false'}>
            <button
              type="button"
              // 使用 mousedown 而非 click：click 会先让 textarea 失去焦点，
              // 光标会跳到文本末尾。
              onmousedown={(e: MouseEvent) => {
                e.preventDefault();
                this.choose(i);
              }}
              onmouseenter={() => {
                this.index = i;
                this.render();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }
}
