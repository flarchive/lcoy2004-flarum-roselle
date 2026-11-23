/*
 * 面板的开关：一个 <button role="switch">，而不是核心的 Switch
 * （带标签的复选框），以便放在卡片标题旁的表头里，
 * 并使用面板自身的尺寸和保存状态。键盘支持
 * 由 <button> 天然提供（空格和回车）。
 */
export const AdminSwitch: any = {
  view({ attrs: { state, disabled, saving, onchange, label, id, describedBy } }: any) {
    return (
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={state ? 'true' : 'false'}
        aria-label={label}
        aria-describedby={describedBy}
        disabled={!!disabled}
        className={`LcoySwitch${state ? ' is-on' : ''}${saving ? ' is-saving' : ''}`}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          if (!disabled) onchange(!state);
        }}
      >
        <span className="LcoySwitch-thumb" aria-hidden="true" />
      </button>
    );
  },
};
