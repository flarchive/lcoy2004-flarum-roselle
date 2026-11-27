/*
 * “配色方案”（设置）的缩略图，使用主题的布局绘制——
 * 页头中间带搜索、侧栏带“发起讨论”和
 * 分类，以及带标签页和列表的卡片——而不是核心绘制的
 * Flarum 默认页面。
 *
 * 每个缩略图都有自己的 `data-theme`，因此其中的 `--lcoy-*`
 * 令牌会按模式显示浅色、深色或高对比度。
 */
import { override } from 'flarum/common/extend';
import ThemeMode from 'flarum/common/components/ThemeMode';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

/** 假分类的颜色：取自 Discourse，只为让缩略图更生动。 */
const CATEGORY_COLORS = ['#0088cc', '#e45735', '#f1592a', '#3ab54a'];

function preview(): Mithril.Children {
  return (
    <div className="ThemeMode-preview LcoyThemePreview">
      <div className="LcoyThemePreview-header">
        <span className="LcoyThemePreview-burger" />
        <span className="LcoyThemePreview-logo" />
        <span className="LcoyThemePreview-search" />
        <span className="LcoyThemePreview-avatar" />
      </div>
      <div className="LcoyThemePreview-body">
        <div className="LcoyThemePreview-sidebar">
          <span className="LcoyThemePreview-newTopic" />
          {[0, 1, 2].map((i) => (
            <span className={classList('LcoyThemePreview-link', { 'LcoyThemePreview-link--active': i === 0 })} key={`link${i}`}>
              <i />
              <b />
            </span>
          ))}
          <span className="LcoyThemePreview-section" />
          {CATEGORY_COLORS.map((color, i) => (
            <span className="LcoyThemePreview-link" key={`cat${i}`}>
              <i style={{ background: color, borderRadius: '1px' }} />
              <b />
            </span>
          ))}
        </div>
        <div className="LcoyThemePreview-main">
          <div className="LcoyThemePreview-card">
            <div className="LcoyThemePreview-nav">
              <span className="LcoyThemePreview-tab LcoyThemePreview-tab--active" />
              <span className="LcoyThemePreview-tab" />
              <span className="LcoyThemePreview-tab" />
              <span className="LcoyThemePreview-button" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div className="LcoyThemePreview-row" key={`row${i}`}>
                <span className="LcoyThemePreview-title" style={{ width: `${[70, 55, 62, 48][i]}%` }} />
                <span className="LcoyThemePreview-badge" style={{ background: CATEGORY_COLORS[i] }} />
                <span className="LcoyThemePreview-count" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function installThemePreview() {
  override(ThemeMode.prototype, 'view', function (this: ThemeMode, _original: unknown, vnode: Mithril.Vnode<any, any>) {
    const { mode, selected, className, alternate, label, ...attrs } = vnode.attrs;

    return (
      <label
        className={classList('ThemeMode', className, `ThemeMode--${mode}`, { 'ThemeMode--active': selected, 'ThemeMode--switch': alternate })}
        {...attrs}
      >
        <div
          className="ThemeMode-container"
          data-theme={mode === 'auto' ? 'light' : mode}
          data-colored-header={document.documentElement.getAttribute('data-colored-header')}
        >
          {preview()}
          {/* “系统偏好”：右上角斜切出的深色版本。 */}
          {mode === 'auto' ? <ThemeMode mode="dark" alternate={true} selected={selected} {...attrs} /> : null}
        </div>
        {!alternate ? <div className="ThemeMode-legend">{label}</div> : null}
      </label>
    );
  });
}
