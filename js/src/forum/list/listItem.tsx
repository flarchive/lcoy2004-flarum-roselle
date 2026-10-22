/*
 * A linha da lista de tópicos do Discourse: [Tópico | Postadores | Respostas |
 * Visualizações | Atividade] no desktop; avatar, título e contagem no celular.
 *
 * Mexe só nas ItemLists do DiscussionListItem: o que outras extensões põem em
 * infoItems (o excerto do sticky, a digitação do realtime) e em statsItems
 * continua aparecendo, só que no lugar do Discourse.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import IndexPage from 'flarum/forum/components/IndexPage';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import Tooltip from 'flarum/common/components/Tooltip';
import listItems from 'flarum/common/helpers/listItems';
import highlight from 'flarum/common/helpers/highlight';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import stringToColor from 'flarum/common/utils/stringToColor';
import { truncate } from 'flarum/common/utils/string';
import type ItemList from 'flarum/common/utils/ItemList';
import Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { fullDate, shortAge } from '../utils/dates';
import { discussionBadges } from '../utils/tags';
import { activityCold, discussionViews, repliesHeat } from './metrics';
import { viewsHeat, viewsNumber } from '../utils/views';

/**
 * O atributo `canelaParticipants` (extend/topic.php): só o que o avatar da
 * linha desenha. Vem como objeto simples, e não como relação de `users`, para
 * a lista não pagar a serialização (e as consultas) de cada usuário.
 */
interface Participant {
  id: string;
  username: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  avatarSrcset: string | null;
}

/** Um usuário já carregado pela linha, no mesmo formato do atributo. */
function fromUser(user: User): Participant {
  return {
    id: String(user.id()),
    username: user.username(),
    displayName: user.displayName(),
    slug: user.slug(),
    avatarUrl: user.avatarUrl(),
    avatarSrcset: user.avatarSrcset(),
  };
}

/**
 * Chaves do infoItems que a linha nova desenha em outro lugar (ou dispensa).
 *
 * `discussion-views` é o "👁 56" do fof/discussion-views: o número dele é o
 * mesmo que a coluna de visualizações do tema mostra (o tema lê o atributo
 * `views` da extensão), então o olho sairia repetindo a informação.
 *
 * O fof/synopsis põe o mesmo excerto em duas chaves (`excerpt` para
 * desktop/tablet e `excerptM` para o celular, cada uma escondida no outro
 * tamanho de tela). Como o tema desenha o excerto com a cara do Discourse em
 * qualquer tela (`.CanelaTopic-excerpt`), as duas saem da lista — senão no
 * celular o `excerptM` ficava visível ao lado do excerto do tema, duplicado.
 */
const MOVED_INFO = ['tags', 'terminalPost', 'excerpt', 'excerptM', 'discussion-views'];

/**
 * O MinimalDiscussionListItem (resultados do modal de busca) herda desta
 * classe; lá a linha compacta do core continua valendo. A classe CSS é o único
 * jeito estável de reconhecê-lo — o módulo pode nem estar carregado. (Por isso
 * o tema não estende elementAttrs: a checagem chama elementAttrs e entraria em
 * laço; o CSS da linha mira `.CanelaList .DiscussionListItem`.)
 */
function isMinimal(item: DiscussionListItem): boolean {
  return String(item.elementAttrs().className || '').includes('MinimalDiscussionListItem');
}

function heatClass(heat: string | null, kind: 'heat' | 'cold' = 'heat'): string | undefined {
  return heat && forumBool('canelaListHeat', true) ? `CanelaCell--${kind}-${heat}` : undefined;
}

/**
 * O avatar da coluna, desenhado do objeto enxuto: `<img>` quando há imagem e
 * a inicial sobre a cor derivada do nome quando não há — o mesmo fallback do
 * `Avatar` do core, sem precisar de um modelo `User`.
 */
function posterAvatar(poster: Participant, role: string, className = ''): Mithril.Children {
  const label = `${poster.displayName}: ${role}`;

  return (
    <Tooltip text={label}>
      <Link href={app.route('user', { username: poster.slug })} className={classList('CanelaPosters-avatar', className)} aria-label={label}>
        {poster.avatarUrl ? (
          <img className="Avatar" src={poster.avatarUrl} srcSet={poster.avatarSrcset || undefined} alt="" loading="lazy" />
        ) : (
          <span className="Avatar" style={{ '--avatar-bg': `#${stringToColor(poster.displayName)}` }} role="img" aria-label={poster.displayName}>
            {poster.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}

export default function installListItem(): void {
  // Ao voltar de um tópico, o Discourse pinta a linha dele com --tertiary-low
  // e apaga em 2,5s (`.topic-list-item.highlighted`). O core já guarda qual
  // foi (lastDiscussion) e rola até ela; o tema só acende a linha.
  extend(IndexPage.prototype, 'oncreate', function (this: IndexPage) {
    const last = this.lastDiscussion;

    if (!last) return;

    const row = this.element?.querySelector(`li[data-id="${last.id()}"] .DiscussionListItem`);

    if (!row) return;

    row.classList.add('CanelaListItem--highlighted');
    row.addEventListener('animationend', () => row.classList.remove('CanelaListItem--highlighted'), { once: true });
  });

  extend(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (isMinimal(this)) return;

    // O avatar grande da esquerda e a coluna de estatísticas do core saem:
    // o Discourse mostra os postadores e os números em colunas próprias.
    items.remove('author');
    items.remove('stats');

    // Só no celular (o CSS esconde no desktop), como o avatar de 48px do Discourse.
    items.add('canelaAvatar', avatarView(this), 100);

    if (forumBool('canelaListPosters', true)) {
      items.add('canelaPosters', postersView(this), 60);
    }

    items.add('canelaReplies', repliesView(this), 50);

    if (forumBool('canelaListViews', true)) {
      // Sempre desenhada: quem decide se a coluna aparece é a lista inteira
      // (classe no DiscussionList), não cada linha. O número vem do tema ou do
      // fof/discussion-views — ver `discussionViews` em ./metrics.
      items.add('canelaViews', viewsView(this), 40);
    }

    items.add('canelaActivity', activityView(this), 30);
  });

  // O tryhackx/flarum-thumb-sliders injeta o slider em qualquer contentItems,
  // inclusive no MinimalDiscussionListItem do modal de busca, onde a linha é
  // compacta e ele não cabe. Sai depois de todas as extensões, por isso um
  // override (e não um extend).
  override(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, original: () => ItemList<Mithril.Children>) {
    const items = original();

    if (isMinimal(this)) items.remove('thumbSlider');

    return items;
  });

  override(DiscussionListItem.prototype, 'mainView', function (this: DiscussionListItem, original: () => Mithril.Children) {
    if (isMinimal(this)) return original();

    const discussion = this.attrs.discussion;
    const jumpTo = this.getJumpTo();
    const info = this.infoItems();
    const searching = !!this.attrs.params.q;

    // O excerto do fixado é opcional; o da busca, não — ele é o resultado.
    const excerpt =
      info.has('excerpt') && (searching || forumBool('canelaListExcerpts', true)) ? excerptView(this, info.get('excerpt'), searching) : null;

    MOVED_INFO.forEach((key) => info.remove(key));

    // statsItems de extensões (curtidas, por exemplo) não têm coluna própria:
    // vão para a linha das etiquetas. A contagem de respostas já é coluna.
    const extraStats = this.statsItems();
    extraStats.remove('replyCount');

    const badgeList = discussion.badges();

    // No Discourse o cadeado (fechado) vem antes do alfinete (fixado).
    if (badgeList.has('locked')) badgeList.setPriority('locked', 1000);

    const badges = badgeList.toArray();

    return (
      <div className="DiscussionListItem-main CanelaTopic">
        <h2 className="DiscussionListItem-title CanelaTopic-titleLine">
          {badges.length > 0 && <span className="CanelaTopic-status">{badges}</span>}
          <Link href={app.route.discussion(discussion, jumpTo)} className="CanelaTopic-title">
            {highlight(discussion.title(), this.highlightRegExp)}
          </Link>
          {unreadView(this)}
        </h2>
        <div className="CanelaTopic-meta">
          {discussionBadges(discussion)}
          {!info.isEmpty() && <ul className="DiscussionListItem-info CanelaTopic-info">{listItems(info.toArray())}</ul>}
          {!extraStats.isEmpty() && <span className="CanelaTopic-stats">{extraStats.toArray()}</span>}
        </div>
        {excerpt ? <div className="CanelaTopic-excerpt">{excerpt}</div> : null}
      </div>
    );
  });
}

/**
 * Bolinha de "tópico novo" (nunca aberto) ou pílula com as não lidas, como o
 * Discourse. As duas marcam como lido ao clicar, igual à contagem do core.
 */
function unreadView(item: DiscussionListItem): Mithril.Children {
  const discussion = item.attrs.discussion;

  if (!app.session.user || !discussion.isUnread()) return null;

  const neverRead = !discussion.lastReadPostNumber();
  const label = neverRead ? t('list.new_topic') : t('list.unread_count', { count: discussion.unreadCount() });

  return (
    <button
      type="button"
      className={classList('Button--ua-reset CanelaUnread', neverRead ? 'CanelaUnread--new' : 'CanelaUnread--count')}
      title={`${label}: ${t('list.mark_read')}`}
      aria-label={`${label}: ${t('list.mark_read')}`}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        item.markAsRead();
      }}
    >
      {neverRead ? null : abbreviateNumber(discussion.unreadCount())}
    </button>
  );
}

/**
 * O excerto do fixado termina com "… ler mais" quando foi cortado, como o
 * `.topic-excerpt-more` do Discourse. O flarum/sticky entrega o texto já
 * truncado dentro de um div; o tema refaz o corte para pôr o link na mesma
 * linha. O da busca (trecho com destaque) fica como veio.
 */
function excerptView(item: DiscussionListItem, original: Mithril.Children, searching: boolean): Mithril.Children {
  const discussion = item.attrs.discussion;
  const text = discussion.attribute<string | null>('firstPostExcerpt');

  if (searching || typeof text !== 'string' || !text) return original;

  const limit = 175;

  if (text.length <= limit) return text;

  return [
    truncate(text, limit),
    ' ',
    <Link href={app.route.discussion(discussion)} className="CanelaTopic-excerptMore">
      {t('list.read_more')}
    </Link>,
  ];
}

function avatarView(item: DiscussionListItem): Mithril.Children {
  const user = item.attrs.author || item.attrs.discussion.user();

  return (
    <div className="CanelaListItem-avatar">
      {user ? (
        <Link href={app.route.user(user)} aria-label={user.displayName()}>
          <Avatar user={user} title="" />
        </Link>
      ) : (
        <Avatar user={null} title="" />
      )}
    </div>
  );
}

function postersView(item: DiscussionListItem): Mithril.Children {
  const discussion: Discussion = item.attrs.discussion;
  const author = item.attrs.author || discussion.user();
  const last = discussion.replyCount() ? discussion.lastPostedUser() : null;
  const relevantPost = item.attrs.params.q ? discussion.mostRelevantPost() : null;
  const relevant = relevantPost ? relevantPost.user() : null;

  // O "último postador" do Discourse (`a.latest`): quem respondeu por último
  // ou, sem respostas, o próprio autor. É o único avatar que sobra no tablet.
  const latest = last || author;

  // O API manda até cinco participantes por discussão (o autor primeiro,
  // depois os mais recentes): quatro vão à vista e o quinto vira o "+".
  const participants = discussion.attribute<Participant[]>('canelaParticipants') || [];

  let posters: Participant[];

  if (participants.length) {
    posters = participants;
  } else {
    // Sem o atributo (resultado de busca, payload antigo): monta com o que a
    // linha já tem — autor, post relevante e último postador.
    const seen = new Set<string>();
    const fallback: Participant[] = [];

    const push = (user: User | null | false | undefined) => {
      if (!user || seen.has(user.id()!)) return;

      seen.add(user.id()!);
      fallback.push(fromUser(user));
    };

    push(author);
    push(relevant);
    push(last);

    posters = fallback;
  }

  const shown = posters.slice(0, 4);
  const authorId = author?.id();
  const latestId = latest?.id();

  const avatars = shown.map((poster) => {
    const isLatest = !!latestId && poster.id === latestId;
    const role = poster.id === authorId ? t('list.original_poster') : isLatest ? t('list.most_recent_poster') : t('list.participant');

    return posterAvatar(
      poster,
      role,
      classList({
        'CanelaPosters-avatar--latest': isLatest,
        // O autor que também postou por último brilha, se houver outros
        // avatares ao lado (`.avatar.latest:not(.single)`).
        'CanelaPosters-avatar--glow': isLatest && poster.id === shown[0].id && shown.length > 1,
      })
    );
  });

  return (
    <div className="CanelaCell CanelaCell--posters CanelaPosters">
      {avatars}
      {posters.length > shown.length ? (
        <span className="CanelaPosters-more" title={t('list.more_participants')} aria-label={t('list.more_participants')}>
          +
        </span>
      ) : null}
    </div>
  );
}

function repliesView(item: DiscussionListItem): Mithril.Children {
  const count = item.attrs.discussion.replyCount() ?? 0;

  return (
    <div className={classList('CanelaCell CanelaCell--replies', heatClass(repliesHeat(count)))}>
      <span aria-hidden="true">{abbreviateNumber(count)}</span>
      <span className="visually-hidden">{t('list.replies_a11y', { count })}</span>
    </div>
  );
}

function viewsView(item: DiscussionListItem): Mithril.Children {
  const views = discussionViews(item.attrs.discussion);

  return (
    <div className={classList('CanelaCell CanelaCell--views', views !== null && heatClass(viewsHeat(views)))}>
      {/* O `dNumber … numberKey="views_long"` do Discourse: "1,2k" com o title por extenso. */}
      {views === null ? null : viewsNumber(views)}
    </div>
  );
}

function activityView(item: DiscussionListItem): Mithril.Children {
  const discussion: Discussion = item.attrs.discussion;
  const created = discussion.createdAt();
  const last = discussion.lastPostedAt() || created;
  const title = [
    t('list.created_at', { date: fullDate(created) }),
    discussion.replyCount() ? t('list.last_reply_at', { date: fullDate(last) }) : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={classList('CanelaCell CanelaCell--activity', heatClass(activityCold(discussion), 'cold'))} title={title}>
      <Link href={app.route.discussion(discussion, discussion.lastPostNumber() ?? undefined)} className="CanelaActivity">
        {shortAge(last)}
      </Link>
    </div>
  );
}
