/*
 * Área de texto que salva sozinha, um tempo depois de a pessoa parar de
 * digitar — uma requisição por pausa, não por tecla.
 */
import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting } from '../util';

const SAVE_DELAY_MS = 600;

export default class AdminTextarea extends AdminComponent {
  saveTimer: ReturnType<typeof setTimeout> | undefined;
  pending: string | null = null;

  view() {
    const { settingKey, label, help, placeholder, rows = 5 } = this.attrs;
    const id = `CanelaAdmin-${String(settingKey).replace(/\W+/g, '-')}`;

    return (
      <div className="Form-group CanelaAdmin-textarea">
        {label && (
          <label className="CanelaAdmin-label" for={id}>
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
    // Na hora em app.data, para um redesenho antes do POST não "desfazer" o texto.
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

    // Sair da página no meio da pausa não pode perder o que foi digitado.
    this.flush();
  }
}
