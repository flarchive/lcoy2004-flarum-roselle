import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting, trans } from '../util';

const KEY = 'lcoy-roselle.admin.settings';
const MIN = 960;
const MAX = 1800;
const DEFAULT = 1110;
/** A tela de referência da prévia: larga o bastante para «largo» e «extra largo» se distinguirem. */
const SCREEN = 1680;

/** As opções prontas: px, ou porcentagem da área ao lado da barra lateral. */
const PRESETS: { value: string; label: string; fallback: string }[] = [
  { value: '1110', label: 'content_width_default', fallback: 'Padrão' },
  { value: '1280', label: 'content_width_wide', fallback: 'Largo' },
  { value: '1440', label: 'content_width_wider', fallback: 'Extra largo' },
  { value: '90%', label: 'content_width_90', fallback: '90%' },
  { value: '100%', label: 'content_width_full', fallback: 'Largura toda' },
];

/**
 * Largura do cartão de conteúdo (--cn-main-max): opções prontas (padrão,
 * largo, 90%, largura toda) ou um valor manual em px, com a prévia do fórum
 * real numa tela de 1440px.
 */
export default class ContentWidthControl extends AdminComponent {
  /** "1110", "1280"… (px) ou "90%" / "100%". */
  value = String(DEFAULT);
  custom = false;
  saveTimer: ReturnType<typeof setTimeout> | undefined;
  page: 'index' | 'discussion' = 'discussion';
  discussionPath: string | null = null;
  frame: HTMLIFrameElement | null = null;
  loaded = false;
  /** Vigia a prévia até o documento dela aceitar a variável. */
  watchTimer: ReturnType<typeof setInterval> | undefined;

  oninit(vnode: any) {
    super.oninit(vnode);
    const stored = getStr('canela.content_width', String(DEFAULT)).trim();

    this.value = /^(90|100)%$/.test(stored) ? stored : String(clamp(parseInt(stored, 10) || DEFAULT));
    this.custom = !PRESETS.some((preset) => preset.value === this.value);

    // A discussão mais recente, para a prévia da página de discussão.
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
   * O endereço da prévia sempre no mesmo host da página do admin.
   *
   * `baseUrl` pode apontar para outro nome do mesmo servidor (localhost ×
   * 127.0.0.1, por exemplo): o iframe carregaria de outra origem e o
   * `contentDocument` ficaria inacessível — a prévia então nunca mudava de
   * largura. Um caminho relativo à raiz herda o host atual e resolve isso.
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

  /** Reduz a "tela" de 1440px à largura disponível. */
  fit(box: HTMLElement): void {
    const scale = box.clientWidth / SCREEN;

    box.style.setProperty('--canela-preview-scale', String(scale));
    box.style.height = `${900 * scale}px`;
  }

  /**
   * Aplica a largura escolhida dentro do fórum da prévia.
   *
   * Devolve `true` quando o documento já aceita a variável. O `load` do
   * iframe não serve como único gatilho: uma imagem externa que não termina
   * (um CDN fora do ar, por exemplo) o segura para sempre, e a prévia ficava
   * parada no valor salvo.
   */
  apply(): boolean {
    const doc = this.frame?.contentDocument;

    if (!doc || doc.readyState === 'loading' || !doc.documentElement) return false;

    try {
      doc.documentElement.style.setProperty('--cn-main-max', this.cssValue());

      return true;
    } catch {
      // Outra origem: a prévia mostra a largura salva.
      return false;
    }
  }

  /** Tenta aplicar já e continua tentando até o documento da prévia carregar. */
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
      <div className="Form-group CanelaAdmin-contentWidth">
        <label className="CanelaAdmin-label">{trans(`${KEY}.content_width_label`, 'Largura do conteúdo')}</label>
        <div className="CanelaAdmin-contentWidth-presets" role="radiogroup">
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
            {trans(`${KEY}.content_width_custom`, 'Personalizado')}
          </button>
        </div>
        {this.custom && (
          <div className="CanelaAdmin-contentWidth-row">
            <input
              type="range"
              min={MIN}
              max={MAX}
              step={10}
              value={px}
              oninput={(e: InputEvent) => this.set(String(clamp(parseInt((e.target as HTMLInputElement).value, 10))))}
            />
            <span className="CanelaAdmin-contentWidth-value">{`${px}px`}</span>
          </div>
        )}
        <p className="helpText">
          {trans(
            `${KEY}.content_width_help`,
            'A largura máxima do cartão de conteúdo (lista, discussão, perfil); na discussão, a coluna dos posts cresce junto. O padrão é 1110px, como no Discourse; 90% e Largura toda acompanham a tela. A prévia mostra o fórum de verdade numa tela de {width}px.',
            { width: SCREEN }
          )}
        </p>

        <div className="CanelaAdmin-contentWidth-tabs">
          {(['index', 'discussion'] as const).map((page) => (
            <button
              type="button"
              className={'Button Button--text' + (this.page === page ? ' active' : '')}
              onclick={() => {
                this.page = page;
                this.loaded = false;
              }}
            >
              {page === 'index'
                ? trans(`${KEY}.content_width_preview_index`, 'Início')
                : trans(`${KEY}.content_width_preview_discussion`, 'Discussão')}
            </button>
          ))}
        </div>

        {/* O fórum de verdade, numa tela de 1440px reduzida: a largura muda ao vivo
            (a variável --cn-main-max é trocada dentro do iframe, mesma origem). */}
        <div className="CanelaAdmin-contentWidth-preview" aria-hidden="true">
          <div className="CanelaAdmin-contentWidth-frame" oncreate={(v: any) => this.fit(v.dom)} onupdate={(v: any) => this.fit(v.dom)}>
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
          <span className="CanelaAdmin-contentWidth-caption">{trans(`${KEY}.content_width_caption`, '{width}px screen', { width: SCREEN })}</span>
        </div>
      </div>
    );
  }

  set(value: string) {
    this.value = value;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveSetting({ 'canela.content_width': String(this.value) }), 500);
    app.data.settings['canela.content_width'] = String(this.value);
    this.apply();
  }
}

function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value / 10) * 10));
}
