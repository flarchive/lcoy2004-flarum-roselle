/*
 * 加载指示器选择（“加载指示器”卡片）。
 *
 * 现成的图案来自 admin 的 payload（src/Theme/Loader/
 * LoaderAdminPayload.php），与发送到论坛样式表的来源相同：
 * 预览没有自己的一份 SVG 副本。预览使用遮罩绘制，与论坛相同
 * （less/forum/Loader.less），因此显示的是真实颜色和尺寸。
 *
 * 每次保存这些键都会重新编译论坛 CSS（它们是 LESS
 * 变量）：这里没有任何操作按按键保存。自定义 SVG 只在点击
 * “应用”或上传文件时写入；颜色在选择器的 `change` 时写入。
 */
import app from 'flarum/admin/app';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

import { AdminComponent, getBool, getStr, saveSetting, trans } from '../util';
import AdminToggle from './AdminToggle';
import AdminNumber from './AdminNumber';
import { AdminNotice } from './AdminCard';

const KEY = 'lcoy-roselle.admin.settings.loader';

/** 与服务器相同的上限（LoaderLess::MAX_BYTES）。 */
const MAX_BYTES = 65536;

const SIZE = { min: 50, max: 250, fallback: 100 };

/** 只有十六进制值才会进入 `style`：该值来自数据库。 */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const presets = (): Record<string, string> => (app.data as any).lcoyLoaderPresets || {};

/** 作为图片，SVG 不会执行任何内容：粘贴内容的预览不必等待服务器。 */
const svgUrl = (svg: string): string => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

const label = (style: string): string => {
  const fallbacks: Record<string, string> = {
    default: 'Flarum 默认',
    avocado: '牛油果',
    orbital: '环绕',
    ring: 'Discourse 圆环',
    dots: '圆点',
    bars: '条形',
    pulse: '脉冲',
    custom: '自定义 SVG',
  };

  return trans(`${KEY}.style_${style}`, fallbacks[style] ?? style);
};

export default class LoaderPicker extends AdminComponent {
  /** 输入框中的 SVG（尚未应用），或 `null` = 已保存的那个。 */
  draft: string | null = null;
  error: string | null = null;

  view() {
    const style = getStr('lcoy.loader_style', 'default');
    const custom = this.draft ?? getStr('lcoy.loader_custom');
    const styles = ['default', ...Object.keys(presets()), 'custom'];
    const color = getStr('lcoy.loader_color');

    return (
      <div className="LcoyLoaderPicker">
        <div className="Form-group">
          <label className="LcoyAdmin-label">{trans(`${KEY}.style_label`, '样式')}</label>
          <div className="LcoyLoaderPicker-grid" role="radiogroup">
            {styles.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={style === key ? 'true' : 'false'}
                className={`LcoyLoaderPicker-option${style === key ? ' is-selected' : ''}`}
                onclick={() => this.choose(key)}
              >
                <span className="LcoyLoaderPicker-stage" style={this.stageStyle(color)}>
                  {this.sample(key, custom)}
                </span>
                <span className="LcoyLoaderPicker-name">{label(key)}</span>
              </button>
            ))}
          </div>
        </div>

        {style === 'custom' && this.customFields(custom)}

        {style !== 'default' && (
          <>
            {this.colorField(color)}
            <AdminNumber
              settingKey="lcoy.loader_size"
              min={SIZE.min}
              max={SIZE.max}
              fallback={SIZE.fallback}
              suffix="%"
              label={trans(`${KEY}.size_label`, '大小')}
              help={trans(`${KEY}.size_help`, '相对 Flarum 转圈图标的大小，可选 {min}% 到 {max}%。在按钮中，指示器会跟随文字大小。', {
                min: SIZE.min,
                max: SIZE.max,
              })}
            />
            {this.preview(style, custom, color)}
          </>
        )}

        <AdminNotice>{trans(`${KEY}.notice`, '更换加载动画会重新编译论坛 CSS，保存需要几秒钟。')}</AdminNotice>
      </div>
    );
  }

  stageStyle(color: string): Record<string, string> {
    return HEX_COLOR.test(color) ? { color } : {};
  }

  /** 某个样式的图案，按请求的尺寸。 */
  sample(key: string, custom: string, size = 32): any {
    if (key === 'default') {
      return <LoadingIndicator display="inline" size="large" />;
    }

    const svg = key === 'custom' ? custom.trim() : presets()[key];

    if (!svg) {
      return <i className="fas fa-file-arrow-up LcoyLoaderPicker-empty" aria-hidden="true" />;
    }

    const tint = key !== 'custom' || getBool('lcoy.loader_tint');

    return (
      <span
        className={`LcoyLoaderPicker-svg${tint ? '' : ' LcoyLoaderPicker-svg--image'}`}
        style={{ '--lcoy-lp-image': svgUrl(svg), '--lcoy-lp-size': `${size}px` }}
        aria-hidden="true"
      />
    );
  }

  customFields(custom: string) {
    const changed = this.draft !== null && this.draft !== getStr('lcoy.loader_custom');

    return (
      <div className="LcoyAdmin-subGroup">
        <div className="Form-group LcoyAdmin-textarea">
          <label className="LcoyAdmin-label" for="LcoyLoaderPicker-code">
            {trans(`${KEY}.custom_label`, 'SVG 代码')}
          </label>
          <textarea
            id="LcoyLoaderPicker-code"
            className="FormControl LcoyLoaderPicker-code"
            rows={6}
            spellcheck={false}
            placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">…</svg>'
            value={custom}
            oninput={(event: InputEvent) => {
              this.draft = (event.target as HTMLTextAreaElement).value;
              this.error = null;
            }}
          />
          <p className="helpText">
            {trans(
              `${KEY}.custom_help`,
              '粘贴动画 SVG 的代码，或上传 .svg 文件（最大 64 KB）。保存前会在服务器上清理：脚本、事件和外部链接都会被移除，CSS 和 SMIL 动画则保留。'
            )}
          </p>
          {this.error && <p className="LcoyLoaderPicker-error">{this.error}</p>}
          {!custom.trim() && (
            <p className="helpText">{trans(`${KEY}.custom_empty`, '请粘贴或上传 SVG 以使用此样式。在此之前，论坛仍会使用 Flarum 的转圈图标。')}</p>
          )}
          <div className="LcoyAdmin-actions">
            <button type="button" className="Button Button--primary" disabled={!changed} onclick={() => this.applyCustom(this.draft ?? '')}>
              {trans(`${KEY}.custom_apply`, '应用 SVG')}
            </button>
            <label className="Button LcoyLoaderPicker-upload">
              <i className="fas fa-upload Button-icon" aria-hidden="true" />
              <span className="Button-label">{trans(`${KEY}.custom_upload`, '上传 SVG 文件')}</span>
              <input type="file" accept=".svg,image/svg+xml" onchange={(event: Event) => this.upload(event.target as HTMLInputElement)} />
            </label>
            {custom.trim() !== '' && (
              <button type="button" className="Button" onclick={() => this.applyCustom('')}>
                {trans(`${KEY}.custom_clear`, '移除')}
              </button>
            )}
          </div>
        </div>
        <AdminToggle
          settingKey="lcoy.loader_tint"
          label={trans(`${KEY}.tint_label`, '使用指示器颜色着色')}
          help={trans(`${KEY}.tint_help`, 'SVG 会只保留形状，并用下面的颜色着色（在按钮中则使用文字颜色）。关闭后，文件保留自身的颜色。')}
        />
      </div>
    );
  }

  colorField(color: string) {
    const valid = HEX_COLOR.test(color);
    const primary = String(app.data.settings.theme_primary_color || '#4d698e');

    return (
      <div className="Form-group">
        <label className="LcoyAdmin-label" for="LcoyLoaderPicker-color">
          {trans(`${KEY}.color_label`, '颜色')}
        </label>
        <div className="LcoyLoaderPicker-colorRow">
          <input
            id="LcoyLoaderPicker-color"
            type="color"
            className="LcoyLoaderPicker-color"
            value={valid && color.length === 7 ? color : HEX_COLOR.test(primary) && primary.length === 7 ? primary : '#4d698e'}
            onchange={(event: Event) => this.save('lcoy.loader_color', (event.target as HTMLInputElement).value)}
          />
          <button type="button" className="Button" disabled={!valid} onclick={() => this.save('lcoy.loader_color', '')}>
            {trans(`${KEY}.color_primary`, '使用主题颜色')}
          </button>
        </div>
        <p className="helpText">
          {trans(`${KEY}.color_help`, '未选择颜色时，使用主题的强调色（即主色，在标签页上则为标签颜色）。在按钮中，指示器会跟随按钮文字的颜色。')}
        </p>
      </div>
    );
  }

  /** 大、中、以及按钮内，均按所选尺寸。 */
  preview(style: string, custom: string, color: string) {
    const scale = Math.min(SIZE.max, Math.max(SIZE.min, Number.parseInt(getStr('lcoy.loader_size', '100'), 10) || 100)) / 100;

    return (
      <div className="Form-group">
        <label className="LcoyAdmin-label">{trans(`${KEY}.preview`, '预览')}</label>
        <div className="LcoyLoaderPicker-preview" style={this.stageStyle(color)}>
          {this.sample(style, custom, Math.round(30 * scale))}
          {this.sample(style, custom, Math.round(18 * scale))}
          <span className="Button Button--primary LcoyLoaderPicker-button">
            <span className="Button-label">{trans(`${KEY}.preview_save`, '保存')}</span>
            <span className="LcoyLoaderPicker-buttonIcon">{this.sample(style, custom, 14)}</span>
          </span>
        </div>
      </div>
    );
  }

  choose(style: string): void {
    if (getStr('lcoy.loader_style', 'default') === style) return;

    this.save('lcoy.loader_style', style);
  }

  save(key: string, value: string) {
    const previous = app.data.settings[key];
    app.data.settings[key] = value;
    m.redraw();

    return saveSetting({ [key]: value }).catch((error: unknown) => {
      app.data.settings[key] = previous;
      m.redraw();

      throw error;
    });
  }

  applyCustom(svg: string): void {
    this.error = null;

    if (svg.trim() !== '' && !/<svg[\s>]/i.test(svg)) {
      this.error = trans(`${KEY}.custom_not_svg`, '该文件看起来不是 SVG。');
      return;
    }

    if (new Blob([svg]).size > MAX_BYTES) {
      this.error = trans(`${KEY}.custom_too_big`, '文件超过 64 KB。');
      return;
    }

    this.save('lcoy.loader_custom', svg.trim()).then(
      () => {
        this.draft = null;
        m.redraw();
      },
      () => {
        // 核心提示框已经显示原因（SVG 无效）；文本留在字段中以便修正。
        this.draft = svg;
        m.redraw();
      }
    );
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (file.size > MAX_BYTES) {
      this.error = trans(`${KEY}.custom_too_big`, '文件超过 64 KB。');
      m.redraw();
      return;
    }

    file.text().then((text) => {
      this.draft = text;
      this.applyCustom(text);
      m.redraw();
    });
  }
}
