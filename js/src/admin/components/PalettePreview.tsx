/*
 * 主题根据 Flarum 主色派生出的调色板预览。
 *
 * 色块由面板 CSS（less/admin/LcoySettings.less）使用
 * 与 less/common/tokens.less 相同的 `oklch(from …)` 公式绘制——
 * 预览就是论坛自身的计算，而不是 JS 近似值。颜色通过
 * 样式中的变量传入，变量读取配置：这样预览跟随已保存的颜色，
 * 即使 admin 的 CSS 尚未重新编译——同一块中当前颜色的
 * 色块也永远不会与派生色不一致。
 */
import app from 'flarum/admin/app';
import { trans } from '../util';

const KEY = 'lcoy-roselle.admin.settings';

/** 只有十六进制值才会进入 `style` 属性：该值来自数据库。 */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const SCHEMES = ['light', 'dark'] as const;

const SWATCHES: { key: string; label: () => string }[] = [
  { key: 'accent', label: () => trans(`${KEY}.palette_accent`, '强调色') },
  { key: 'background', label: () => trans(`${KEY}.palette_background`, '淡色背景') },
  { key: 'selected', label: () => trans(`${KEY}.palette_selected`, '选中色') },
  { key: 'accent-low', label: () => trans(`${KEY}.palette_accent_low`, '柔和强调色') },
  { key: 'ring', label: () => trans(`${KEY}.palette_ring`, '聚焦环') },
  { key: 'link', label: () => trans(`${KEY}.palette_link`, '链接') },
];

const primaryColor = (): string | null => {
  const value = String(app.data.settings.theme_primary_color ?? '').trim();

  return HEX_COLOR.test(value) ? value : null;
};

export const PalettePreview: any = {
  view() {
    const color = primaryColor();

    return (
      <div className="LcoyAdmin-palette" style={color ? `--lcoy-preview-accent: ${color}` : undefined}>
        <div className="LcoyAdmin-colorCurrent">
          <span className="LcoyAdmin-label">{trans(`${KEY}.colors_current`, '当前主色')}</span>
          <span className="LcoyAdmin-colorChip">
            <span className="LcoyAdmin-colorDot" aria-hidden="true" />
            <code>{color ?? '-'}</code>
          </span>
        </div>
        {SCHEMES.map((scheme) => (
          <div key={scheme} className={`LcoyAdmin-paletteRow LcoyAdmin-paletteRow--${scheme}`}>
            <span className="LcoyAdmin-paletteScheme">
              {scheme === 'light' ? trans(`${KEY}.palette_light`, '浅色') : trans(`${KEY}.palette_dark`, '深色')}
            </span>
            <div className="LcoyAdmin-swatches">
              {SWATCHES.map((swatch) => (
                <span key={swatch.key} className="LcoyAdmin-swatch" data-swatch={swatch.key}>
                  <span className="LcoyAdmin-swatchColor" aria-hidden="true" />
                  <span className="LcoyAdmin-swatchLabel">{swatch.label()}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
