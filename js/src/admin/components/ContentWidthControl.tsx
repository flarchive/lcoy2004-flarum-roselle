import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting, trans } from '../util';

const KEY = 'lcoy-roselle.admin.settings';
const MIN = 960;
const MAX = 1800;
const DEFAULT = 1110;
/** 预览的参考屏幕：足够宽，以便区分“宽”和“超宽”。 */
const SCREEN = 1680;

/** 预设选项：px，或侧边栏旁区域的百分比。 */
const PRESETS: { value: string; label: string; fallback: string }[] = [
  { value: '1110', label: 'content_width_default', fallback: '默认' },
  { value: '1280', label: 'content_width_wide', fallback: '宽' },
  { value: '1440', label: 'content_width_wider', fallback: '超宽' },
  { value: '90%', label: 'content_width_90', fallback: '90%' },
  { value: '100%', label: 'content_width_full', fallback: '全宽' },
];

/**
 * 内容卡片宽度（--lcoy-main-max）：预设选项（默认、
 * 宽、90%、全宽）或手动输入的 px 值，并在 1440px 屏幕上
 * 预览真实论坛。
 */
export default class ContentWidthControl extends AdminComponent {
  /** "1110"、"1280"……（px）或 "90%" / "100%"。 */
  value = String(DEFAULT);
  custom = false;
  saveTimer: ReturnType<typeof setTimeout> | undefined;
  page: 'index' | 'discussion' = 'discussion';
  discussionPath: string | null = null;
  frame: HTMLIFrameElement | null = null;
  loaded = false;
  /** 监视预览，直到其文档接受该变量。 */
  watchTimer: ReturnType<typeof setInterval> | undefined;

  oninit(vnode: any) {
    super.oninit(vnode);
    const stored = getStr('lcoy.content_width', String(DEFAULT)).trim();

    this.value = /^(90|100)%$/.test(stored) ? stored : String(clamp(parseInt(stored, 10) || DEFAULT));
    this.custom = !PRESETS.some((preset) => preset.value === this.value);

    // 最新的讨论，用于讨论页预览。
    app
      .request<any>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/discussions`, params: { 'page[limit]': 1, sort: '-lastPostedAt' } })
      .then((res) => {
        const d = res?.data?.[0];
        this.discussionPath = d ? `/d/${d.id}-${d.attributes?.slug || ''}` : null;
        m.redraw();
      })
      .catch(() => {});
  }

  /**
   * 预览地址始终位于 admin 页面所在的主机上。
   *
   * `baseUrl` 可能指向同一服务器的另一个名称（例如 localhost ×
   * 127.0.0.1）：iframe 会从另一个源加载，
   * `contentDocument` 将无法访问——预览也就永远不会改变
   * 宽度。相对于根路径的地址会继承当前主机，从而解决这个问题。
   */
  previewUrl(): string | null {
    if (this.page === 'discussion' && !this.discussionPath) return null;

    const path = this.page === 'discussion' ? this.discussionPath! : '/';
    const base = String(app.forum.attribute('baseUrl') || '');

    try {
      const prefix = new URL(base, window.location.origin).pathname.replace(/\/+$/, '');

      return prefix + path;
    } catch {
      return path;
    }
  }

  /** 把 1440px 的“屏幕”缩放到可用宽度。 */
  fit(box: HTMLElement): void {
    const scale = box.clientWidth / SCREEN;

    box.style.setProperty('--lcoy-preview-scale', String(scale));
    box.style.height = `${900 * scale}px`;
  }

  /**
   * 在预览论坛中应用所选宽度。
   *
   * 当文档已接受该变量时返回 `true`。iframe 的 `load` 不能作为
   * 唯一触发条件：一个无法完成加载的外部图片（例如宕机的 CDN）
   * 会让它永远等待，预览便一直停留在已保存的值上。
   */
  apply(): boolean {
    const doc = this.frame?.contentDocument;

    if (!doc || doc.readyState === 'loading' || !doc.documentElement) return false;

    try {
      doc.documentElement.style.setProperty('--lcoy-main-max', this.cssValue());

      return true;
    } catch {
      // 跨源：预览显示已保存的宽度。
      return false;
    }
  }

  /** 立即尝试应用，并持续尝试直到预览文档加载完成。 */
  watch(frame: HTMLIFrameElement): void {
    this.frame = frame;
    clearInterval(this.watchTimer);

    if (this.apply()) return;

    let tries = 0;
    this.watchTimer = setInterval(() => {
      if (this.apply() || ++tries > 120) clearInterval(this.watchTimer);
    }, 250);
  }

  onremove(vnode: any) {
    super.onremove(vnode);
    clearInterval(this.watchTimer);
  }

  cssValue(): string {
    return this.value.endsWith('%') ? this.value : `${this.value}px`;
  }

  view() {
    const px = this.value.endsWith('%') ? DEFAULT : parseInt(this.value, 10);
    const isActive = (value: string) => !this.custom && this.value === value;

    return (
      <div className="Form-group LcoyAdmin-contentWidth">
        <label className="LcoyAdmin-label">{trans(`${KEY}.content_width_label`, '内容宽度')}</label>
        <div className="LcoyAdmin-contentWidth-presets" role="radiogroup">
          {PRESETS.map((preset) => (
            <button
              type="button"
              role="radio"
              aria-checked={isActive(preset.value) ? 'true' : 'false'}
              className={'Button' + (isActive(preset.value) ? ' active' : '')}
              onclick={() => {
                this.custom = false;
                this.set(preset.value);
              }}
            >
              {trans(`${KEY}.${preset.label}`, preset.fallback)}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={this.custom ? 'true' : 'false'}
            className={'Button' + (this.custom ? ' active' : '')}
            onclick={() => {
              this.custom = true;
              this.set(String(px));
            }}
          >
            {trans(`${KEY}.content_width_custom`, '自定义')}
          </button>
        </div>
        {this.custom && (
          <div className="LcoyAdmin-contentWidth-row">
            <input
              type="range"
              min={MIN}
              max={MAX}
              step={10}
              value={px}
              oninput={(e: InputEvent) => this.set(String(clamp(parseInt((e.target as HTMLInputElement).value, 10))))}
            />
            <span className="LcoyAdmin-contentWidth-value">{`${px}px`}</span>
          </div>
        )}
        <p className="helpText">
          {trans(
            `${KEY}.content_width_help`,
            '内容卡片（列表、讨论、个人资料）的最大宽度；在讨论中，帖子栏会随之变宽。默认是 1110px，与 Discourse 相同；90% 和全宽会跟随屏幕。预览会在 {width}px 的屏幕上显示真实论坛。',
            { width: SCREEN }
          )}
        </p>

        <div className="LcoyAdmin-contentWidth-tabs">
          {(['index', 'discussion'] as const).map((page) => (
            <button
              type="button"
              className={'Button Button--text' + (this.page === page ? ' active' : '')}
              onclick={() => {
                this.page = page;
                this.loaded = false;
              }}
            >
              {page === 'index' ? trans(`${KEY}.content_width_preview_index`, '首页') : trans(`${KEY}.content_width_preview_discussion`, '讨论')}
            </button>
          ))}
        </div>

        {/* 真实论坛，在缩小的 1440px 屏幕中：宽度会实时变化
            （--lcoy-main-max 变量在 iframe 内替换，同源）。 */}
        <div className="LcoyAdmin-contentWidth-preview" aria-hidden="true">
          <div className="LcoyAdmin-contentWidth-frame" oncreate={(v: any) => this.fit(v.dom)} onupdate={(v: any) => this.fit(v.dom)}>
            {this.previewUrl() && (
              <iframe
                key={this.previewUrl() ?? undefined}
                src={this.previewUrl()!}
                tabindex="-1"
                oncreate={(v: any) => this.watch(v.dom as HTMLIFrameElement)}
                onload={(e: Event) => this.watch(e.target as HTMLIFrameElement)}
              />
            )}
          </div>
          <span className="LcoyAdmin-contentWidth-caption">{trans(`${KEY}.content_width_caption`, '{width}px 屏幕', { width: SCREEN })}</span>
        </div>
      </div>
    );
  }

  set(value: string) {
    this.value = value;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveSetting({ 'lcoy.content_width': String(this.value) }), 500);
    app.data.settings['lcoy.content_width'] = String(this.value);
    this.apply();
  }
}

function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value / 10) * 10));
}
