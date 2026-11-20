/*
 * 自动保存的文本域，在用户停止输入一段时间后保存——
 * 每次暂停一个请求，而不是每次按键。
 */
import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting } from '../util';

const SAVE_DELAY_MS = 600;

export default class AdminTextarea extends AdminComponent {
  saveTimer: ReturnType<typeof setTimeout> | undefined;
  pending: string | null = null;

  view() {
    const { settingKey, label, help, placeholder, rows = 5 } = this.attrs;
    const id = `LcoyAdmin-${String(settingKey).replace(/\W+/g, '-')}`;

    return (
      <div className="Form-group LcoyAdmin-textarea">
        {label && (
          <label className="LcoyAdmin-label" for={id}>
            {label}
          </label>
        )}
        <textarea
          id={id}
          className="FormControl"
          rows={rows}
          placeholder={placeholder}
          value={getStr(settingKey)}
          oninput={(event: InputEvent) => this.store((event.target as HTMLTextAreaElement).value)}
          onblur={() => this.flush()}
        />
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  store(value: string): void {
    // 立即写入 app.data，这样在 POST 之前的重绘不会“撤销”文本。
    app.data.settings[this.attrs.settingKey] = value;
    this.pending = value;

    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  flush(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;

    if (this.pending === null) return;

    const payload: Record<string, string> = { [this.attrs.settingKey]: this.pending };

    Object.entries(payload).forEach(([key, value]) => (app.data.settings[key] = value));
    this.pending = null;

    saveSetting(payload);
  }

  onremove(vnode: any) {
    super.onremove(vnode);

    // 在暂停期间离开页面不能丢失已输入的内容。
    this.flush();
  }
}
