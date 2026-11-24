import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting } from '../util';

const SAVE_DELAY_MS = 600;

/**
 * 带最小值和最大值的整数，自动保存。
 *
 * 输入过程中，字段显示草稿（`draft`），只保存落在范围内的值：
 * 每次按键都限制会导致最小值为 3 时无法输入“15”（“1”会立刻变成“3”），
 * 而编辑中途被清空的字段不能以空值写入数据库。离开字段时，
 * 值会被调整到范围内，草稿随之消失。
 */
export default class AdminNumber extends AdminComponent {
  draft: string | null = null;
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  view() {
    const { settingKey, label, help, min, max, fallback, suffix } = this.attrs;
    const stored = getStr(settingKey, String(fallback));

    return (
      <div className="Form-group LcoyAdmin-number">
        <label className="LcoyAdmin-label">{label}</label>
        <div className="LcoyAdmin-numberWrap">
          <input
            className="FormControl LcoyAdmin-numberInput"
            type="number"
            inputmode="numeric"
            step={1}
            min={min}
            max={max}
            value={this.draft ?? stored}
            oninput={(event: InputEvent) => this.handleInput((event.target as HTMLInputElement).value)}
            onblur={() => this.commitDraft()}
          />
          {suffix && <span className="LcoyAdmin-numberSuffix">{suffix}</span>}
        </div>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  handleInput(rawValue: string): void {
    this.draft = rawValue;
    const parsed = this.parse(rawValue);

    if (parsed !== null && parsed >= this.attrs.min && parsed <= this.attrs.max) {
      this.store(parsed, SAVE_DELAY_MS);
    }
  }

  commitDraft(): void {
    if (this.draft === null) return;

    const { settingKey, min, max, fallback } = this.attrs;
    const parsed = this.parse(this.draft) ?? this.parse(getStr(settingKey, String(fallback))) ?? fallback;
    const clamped = Math.min(max, Math.max(min, parsed));

    this.draft = null;
    if (String(clamped) !== getStr(settingKey, String(fallback))) this.store(clamped, 0);
  }

  store(value: number, delayMs: number): void {
    const { settingKey } = this.attrs;

    app.data.settings[settingKey] = String(value);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveSetting({ [settingKey]: String(value) }), delayMs);
  }

  parse(rawValue: string): number | null {
    const parsed = Number.parseInt(rawValue, 10);

    return Number.isFinite(parsed) ? parsed : null;
  }
}
