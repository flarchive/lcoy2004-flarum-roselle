/*
 * A seção "Perfil" das Configurações, como a aba Perfil das preferências do
 * Discourse: título, aniversário, status e a capa da forumaker/profile-cover.
 *
 * Bio, local e site vêm do fof/user-bio e do fof/socialprofile, nas próprias
 * seções deles.
 *
 * Os campos são um rascunho local e só vão para a API no "Salvar perfil",
 * num único `user.save()` com o que mudou — salvar a cada tecla dispararia
 * uma requisição (e uma validação) por letra.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { canEditTitle, profileField, userStatus } from './data';
import { thirdParty } from '../../thirdparty/settings';
import { ForumakerCoverField } from '../../thirdparty/profileCover';
import { statusUntilLabel } from './components';
import EmojiPicker from './EmojiPicker';

/** Opções do "Limpar depois de…" do Discourse. */
const CLEAR_OPTIONS = ['never', '30m', '1h', '4h', 'today', 'week', 'custom'] as const;

type ClearOption = (typeof CLEAR_OPTIONS)[number] | 'current';

interface Draft {
  title: string;
  birthdayDate: string;
  birthdayShowYear: boolean;
  statusEmoji: string;
  statusText: string;
  statusClear: ClearOption;
  statusCustom: string;
}

export interface ProfileSettingsSectionAttrs extends ComponentAttrs {
  user: User;
}

export default class ProfileSettingsSection extends Component<ProfileSettingsSectionAttrs> {
  draft!: Draft;
  saved!: Draft;
  saving = false;

  oninit(vnode: Mithril.Vnode<ProfileSettingsSectionAttrs, this>) {
    super.oninit(vnode);
    this.reset();
  }

  /** Lê o usuário de novo: depois de salvar, o salvo vira o ponto de partida. */
  reset() {
    const user = this.attrs.user;
    const status = userStatus(user);
    const str = (attribute: string) => user.attribute<string | null>(attribute) || '';

    this.saved = {
      title: str('canelaTitle'),
      birthdayDate: str('canelaBirthdayDate'),
      birthdayShowYear: !!user.attribute<boolean>('canelaBirthdayShowYear'),
      statusEmoji: status?.emoji || '',
      statusText: status?.text || '',
      statusClear: status?.until ? 'current' : 'never',
      statusCustom: '',
    };

    this.draft = { ...this.saved };
  }

  view() {
    const user = this.attrs.user;

    return (
      <form className="CanelaProfileSettings" onsubmit={(event: SubmitEvent) => this.submit(event)}>
        {profileField('title') && this.titleField(user)}
        {profileField('birthday') && this.birthdayField()}
        {profileField('status') && this.statusField()}
        {/* Com a forumaker/profile-cover a capa é dela: o editor dela aqui. */}
        {thirdParty.profileCover() ? <ForumakerCoverField user={user} /> : null}

        <div className="Form-group CanelaProfileSettings-actions">
          <Button type="submit" className="Button Button--primary" loading={this.saving} disabled={!this.dirty()}>
            {t('profile.settings.save')}
          </Button>
          {this.dirty() && (
            <Button className="Button Button--link" disabled={this.saving} onclick={() => (this.draft = { ...this.saved })}>
              {t('profile.settings.discard')}
            </Button>
          )}
        </div>
      </form>
    );
  }

  titleField(user: User): Mithril.Children {
    if (!canEditTitle(user)) {
      // Título dado pela moderação: aparece, mas não se edita aqui.
      return this.saved.title ? (
        <div className="Form-group">
          <label>{t('profile.settings.title_label')}</label>
          <p className="CanelaProfileSettings-readonly">{this.saved.title}</p>
          <p className="helpText">{t('profile.settings.title_locked')}</p>
        </div>
      ) : null;
    }

    return this.textField(
      'title',
      t('profile.settings.title_label'),
      60,
      t('profile.settings.title_placeholder'),
      'text',
      t('profile.settings.title_help')
    );
  }

  textField(key: 'title', label: string, max: number, placeholder: string, type: string, help?: string): Mithril.Children {
    const id = `CanelaProfile-${key}`;

    return (
      <div className="Form-group">
        <label for={id}>{label}</label>
        <input
          id={id}
          className="FormControl"
          type={type}
          maxlength={max}
          placeholder={placeholder}
          value={this.draft[key]}
          oninput={(event: InputEvent) => (this.draft[key] = (event.target as HTMLInputElement).value)}
        />
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  birthdayField(): Mithril.Children {
    return (
      <div className="Form-group CanelaProfileSettings-birthday">
        <label for="CanelaProfile-birthday">{t('profile.settings.birthday_label')}</label>
        <input
          id="CanelaProfile-birthday"
          className="FormControl"
          type="date"
          min="1900-01-01"
          max={localDate(new Date())}
          value={this.draft.birthdayDate}
          oninput={(event: InputEvent) => (this.draft.birthdayDate = (event.target as HTMLInputElement).value)}
        />
        {this.draft.birthdayDate && (
          <Switch state={this.draft.birthdayShowYear} onchange={(checked: boolean) => (this.draft.birthdayShowYear = checked)}>
            {t('profile.settings.birthday_show_year')}
          </Switch>
        )}
        <p className="helpText">{t('profile.settings.birthday_help')}</p>
      </div>
    );
  }

  statusField(): Mithril.Children {
    const hasStatus = !!(this.draft.statusEmoji || this.draft.statusText);
    const current = userStatus(this.attrs.user)?.until;

    return (
      <div className="Form-group CanelaProfileSettings-status">
        <label for="CanelaProfile-statusText">{t('profile.settings.status_label')}</label>
        <div className="CanelaProfileSettings-statusRow">
          <EmojiPicker value={this.draft.statusEmoji} onchange={(emoji: string) => (this.draft.statusEmoji = emoji)} />
          <input
            id="CanelaProfile-statusText"
            className="FormControl"
            type="text"
            maxlength={100}
            placeholder={t('profile.settings.status_placeholder')}
            value={this.draft.statusText}
            oninput={(event: InputEvent) => (this.draft.statusText = (event.target as HTMLInputElement).value)}
          />
          {hasStatus && (
            <Button
              className="Button Button--icon"
              icon="fas fa-xmark"
              aria-label={t('profile.settings.status_clear')}
              title={t('profile.settings.status_clear')}
              onclick={() => {
                this.draft.statusEmoji = '';
                this.draft.statusText = '';
                this.draft.statusClear = 'never';
              }}
            />
          )}
        </div>

        {hasStatus && (
          <div className="CanelaProfileSettings-statusClear">
            <label for="CanelaProfile-statusClear">{t('profile.settings.status_clear_after')}</label>
            <select
              id="CanelaProfile-statusClear"
              className="FormControl"
              value={this.draft.statusClear}
              onchange={(event: Event) => (this.draft.statusClear = (event.target as HTMLSelectElement).value as ClearOption)}
            >
              {this.saved.statusClear === 'current' && current && <option value="current">{statusUntilLabel(current)}</option>}
              {CLEAR_OPTIONS.map((option) => (
                <option value={option}>{t(`profile.status.clear_${option}`)}</option>
              ))}
            </select>
            {this.draft.statusClear === 'custom' && (
              <input
                className="FormControl"
                type="datetime-local"
                aria-label={t('profile.status.clear_custom')}
                min={localDateTime(new Date())}
                value={this.draft.statusCustom}
                oninput={(event: InputEvent) => (this.draft.statusCustom = (event.target as HTMLInputElement).value)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(this.saved);
  }

  /** Só o que mudou: um campo desligado no admin nunca vai, e a API recusaria. */
  payload(): Record<string, unknown> {
    const { draft, saved } = this;
    const data: Record<string, unknown> = {};
    const text = (value: string) => (value.trim() === '' ? null : value.trim());

    if (profileField('title') && canEditTitle(this.attrs.user) && draft.title !== saved.title) data.canelaTitle = text(draft.title);

    if (profileField('birthday') && (draft.birthdayDate !== saved.birthdayDate || draft.birthdayShowYear !== saved.birthdayShowYear)) {
      data.canelaBirthdayDate = draft.birthdayDate || null;
      data.canelaBirthdayShowYear = draft.birthdayShowYear;
    }

    if (
      profileField('status') &&
      (draft.statusEmoji !== saved.statusEmoji ||
        draft.statusText !== saved.statusText ||
        draft.statusClear !== saved.statusClear ||
        draft.statusCustom !== saved.statusCustom)
    ) {
      const empty = !draft.statusEmoji && !text(draft.statusText);

      data.canelaStatusEmoji = empty ? null : draft.statusEmoji || null;
      data.canelaStatusText = empty ? null : text(draft.statusText);
      data.canelaStatusUntil = empty ? null : this.statusUntil();
    }

    return data;
  }

  /** A data em que o status some, calculada na hora de salvar (e não ao escolher). */
  statusUntil(): Date | null {
    const now = new Date();
    const minutes = (count: number) => new Date(now.getTime() + count * 60_000);

    switch (this.draft.statusClear) {
      case 'current':
        return userStatus(this.attrs.user)?.until ?? null;
      case '30m':
        return minutes(30);
      case '1h':
        return minutes(60);
      case '4h':
        return minutes(240);
      case 'today': {
        const end = new Date(now);
        end.setHours(23, 59, 59, 0);
        return end;
      }
      case 'week': {
        // Até o fim do domingo, como o "Esta semana" do Discourse.
        const end = new Date(now);
        end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
        end.setHours(23, 59, 59, 0);
        return end;
      }
      case 'custom': {
        const custom = this.draft.statusCustom ? new Date(this.draft.statusCustom) : null;
        return custom && !Number.isNaN(custom.getTime()) ? custom : null;
      }
      default:
        return null;
    }
  }

  submit(event: SubmitEvent) {
    event.preventDefault();

    if (this.saving || !this.dirty()) return;

    if (this.draft.statusClear === 'custom' && (this.draft.statusEmoji || this.draft.statusText.trim()) && !this.statusUntil()) {
      app.alerts.show({ type: 'error' }, t('profile.settings.status_custom_required'));
      return;
    }

    const data = this.payload();

    if (!Object.keys(data).length) {
      this.draft = { ...this.saved };
      return;
    }

    this.saving = true;

    this.attrs.user
      .save(data as any)
      .then(() => {
        this.reset();
        app.alerts.show({ type: 'success' }, t('profile.settings.saved'));
      })
      .catch(() => {
        // A API devolve o campo e o motivo; o core já mostra o alerta.
      })
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }
}

const pad = (value: number) => String(value).padStart(2, '0');

/** AAAA-MM-DD no fuso de quem usa (o `toISOString` daria a data em UTC). */
function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDateTime(date: Date): string {
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
