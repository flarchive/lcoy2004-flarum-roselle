/*
 * Onde o perfil estendido aparece fora das Configurações: no UserCard do
 * core (o hero do perfil), no nome dos posts, no avatar do cabeçalho e no
 * modal "Editar usuário" da moderação.
 *
 * Tudo entra por ItemLists com chaves `canela*` próprias, sem trocar os itens
 * de ninguém: o agente do perfil reescreve o `identity` do UserCard, e o
 * título e o status vêm logo abaixo dele, como itens separados.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import CommentPost from 'flarum/forum/components/CommentPost';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import Stream from 'flarum/common/utils/Stream';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { thirdParty } from '../../thirdparty/settings';
import { registerUserIcon } from '../../utils/userIcons';
import { BirthdayFact, StatusEmoji, StatusLine, TitleLine, profileImageStyle } from './components';
import { canEditProfile, canEditTitle, profileEnabled, profileField, userCardBackgroundUrl, userStatus, userTitle } from './data';

export function installUserCard() {
  // As imagens como variáveis CSS no próprio .UserCard: a capa do hero
  // (.CanelaUserHero-cover) herda `--canela-cover`, e o cartão em popover usa
  // `--canela-user-card-bg` como fundo.
  extend(UserCard.prototype, 'view', function (this: any, vnode: Mithril.Vnode<any, any>) {
    // A capa da forumaker (thirdparty/profileCover) vale mesmo com o perfil estendido desligado.
    if (!vnode?.attrs || (!profileEnabled() && !thirdParty.profileCover())) return;

    const user: User = this.attrs.user;
    const images = profileImageStyle(user);

    if (!Object.keys(images).length) return;

    // O core passa `false` como style quando o usuário não tem cor.
    const style = vnode.attrs.style && typeof vnode.attrs.style === 'object' ? vnode.attrs.style : {};
    vnode.attrs.style = { ...style, ...images };
    vnode.attrs.className = classList(vnode.attrs.className, {
      'CanelaProfile--hasCardBg': !!userCardBackgroundUrl(user),
    });
  });

  extend(UserCard.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!profileEnabled()) return;

    const user: User = this.attrs.user;
    const status = StatusLine(user);
    const title = TitleLine(user);

    // Logo abaixo do nome (100), antes das insígnias (90). A bio do
    // fof/user-bio e o local/site do fof/socialprofile entram pelos próprios
    // itens deles, na área `info`.
    if (title) items.add('canelaTitle', title, 99);
    if (status) items.add('canelaStatus', status, 98);
  });

  extend(UserCard.prototype, 'infoItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!profileEnabled()) return;

    const user: User = this.attrs.user;
    const birthday = BirthdayFact(user);

    // Antes de "visto há" (100) e "entrou em" (90), como no Discourse.
    if (birthday) items.add('canelaBirthday', birthday, 110);
  });
}

export function installPostUser() {
  // O emoji do status logo depois do nome, depois dos outros ícones (o selo
  // de verificado vem antes dele, como no Discourse): utils/userIcons.
  registerUserIcon(
    'canelaStatus',
    // Só no cabeçalho do post: no cartão e no perfil o status é a pílula
    // embaixo do nome, e ao lado do nome fica só o selo.
    (user, context) => (context === 'post' ? StatusEmoji(user, 'CanelaStatusEmoji--post') : null),
    -100
  );

  // O título do usuário ao lado do nome no cabeçalho do post. O post usa o
  // SubtreeRetainer, que já redesenha quando o autor muda (freshness do user).
  extend(CommentPost.prototype, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    const user = this.attrs.post?.user?.();
    const title = user && userTitle(user);

    if (title) items.add('canelaUserTitle', <span className="CanelaPostUserTitle">{title}</span>, 94);
  });
}

export function installSessionStatus() {
  // O emoji em selo sobre o avatar do cabeçalho, como no Discourse.
  extend(SessionDropdown.prototype, 'getButtonContent', function (this: any, children: Mithril.Children[]) {
    const user = app.session.user;
    const emoji = user && StatusEmoji(user, 'CanelaStatusEmoji--avatar');

    if (emoji && Array.isArray(children)) children.splice(1, 0, emoji);
  });
}

interface ModeratorDraft {
  title: Stream<string>;
  clearStatus: Stream<boolean>;
}

/**
 * A moderação edita o perfil dos outros pelo "Editar usuário" do core: o
 * título e a limpeza do status, para o caso de abuso. O próprio usuário usa
 * as Configurações — o modal fica como está para ele.
 */
export function installEditUserModal() {
  const module = 'flarum/common/components/EditUserModal';

  const applies = (modal: any): boolean => {
    const user: User | undefined = modal.attrs?.user;

    return !!user && profileEnabled() && user !== app.session.user && canEditProfile(user);
  };

  extend(module as any, 'oninit', function (this: any) {
    if (!applies(this)) return;

    const user: User = this.attrs.user;
    const str = (attribute: string) => user.attribute<string | null>(attribute) || '';

    this.canelaProfile = {
      title: Stream(str('canelaTitle')),
      clearStatus: Stream(false),
    } satisfies ModeratorDraft;
  });

  extend(module as any, 'fields', function (this: any, items: ItemList<Mithril.Children>) {
    const draft: ModeratorDraft | undefined = this.canelaProfile;

    if (!draft || !applies(this)) return;

    const user: User = this.attrs.user;
    const input = (stream: Stream<string>, label: string, max: number, type = 'text') => (
      <div className="Form-group">
        <label>{label}</label>
        <input className="FormControl" type={type} maxlength={max} bidi={stream} />
      </div>
    );

    if (profileField('title') && canEditTitle(user)) items.add('canelaTitle', input(draft.title, t('profile.settings.title_label'), 60), 35);

    const checkbox = (stream: Stream<boolean>, label: string) => (
      <label className="checkbox">
        <input type="checkbox" checked={stream()} onchange={(event: Event) => stream((event.target as HTMLInputElement).checked)} />
        {label}
      </label>
    );

    if (userStatus(user))
      items.add('canelaClear', <div className="Form-group">{checkbox(draft.clearStatus, t('profile.moderation.clear_status'))}</div>, 31);
  });

  extend(module as any, 'data', function (this: any, data: Record<string, unknown>) {
    const draft: ModeratorDraft | undefined = this.canelaProfile;

    if (!draft || !applies(this)) return;

    const user: User = this.attrs.user;
    const changed = (stream: Stream<string>, attribute: string) => stream().trim() !== (user.attribute<string | null>(attribute) || '');
    const value = (stream: Stream<string>) => stream().trim() || null;

    if (profileField('title') && canEditTitle(user) && changed(draft.title, 'canelaTitle')) data.canelaTitle = value(draft.title);

    if (profileField('status') && draft.clearStatus()) {
      data.canelaStatusEmoji = null;
      data.canelaStatusText = null;
      data.canelaStatusUntil = null;
    }
  });
}
