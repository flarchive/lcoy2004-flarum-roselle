/*
 * Números da linha da lista: visualizações (quando alguma extensão as conta),
 * as faixas de "calor" das contagens e o "frio" da atividade, como o heatmap
 * e o coldmap do Discourse.
 */
import type Discussion from 'flarum/common/models/Discussion';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';

import { isExtensionEnabled } from '../utils/settings';

/**
 * O fof/discussion-views conta as visualizações por conta própria e publica o
 * número no atributo `views`. Ligado, o tema continua desenhando a coluna dele,
 * mas lê esse número e descarta o "👁" que a extensão põe na linha — assim a
 * lista tem uma coluna só, com o dado vivo da extensão.
 */
export function pluginProvidesViews(): boolean {
  return isExtensionEnabled('fof-discussion-views');
}

/**
 * O core não conta visualizações. Quem conta é o fof/discussion-views, que
 * publica o número no atributo `views`; `view_count` é o nome da coluna, para
 * o caso de alguma serialização expor o campo sem o mapeamento.
 */
const VIEW_ATTRIBUTES = ['views', 'view_count'];

export function discussionViews(discussion: Discussion): number | null {
  for (const name of VIEW_ATTRIBUTES) {
    const value = discussion.attribute<unknown>(name);

    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }

  return null;
}

/** A coluna inteira só aparece se ao menos uma discussão da lista trouxer o número. */
export function listHasViews(state: DiscussionListState): boolean {
  return state.getPages().some((page) => (page.items as Discussion[]).some((discussion) => discussionViews(discussion) !== null));
}

type Heat = 'low' | 'med' | 'high' | null;

function band(value: number, low: number, med: number, high: number): Heat {
  if (value >= high) return 'high';
  if (value >= med) return 'med';
  if (value >= low) return 'low';

  return null;
}

/**
 * Faixas das respostas. O Discourse mede o calor pela razão curtidas/posts,
 * que o Flarum não tem sem extensão; o volume de respostas é o sinal mais
 * próximo de "conversa animada" que todo fórum tem.
 */
export function repliesHeat(count: number): Heat {
  return band(count, 10, 25, 50);
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * O coldmap do Discourse: quanto mais tempo entre a criação e a última
 * resposta, mais "frio" o tópico — uma conversa antiga ressuscitada aparece
 * em tom diferente de uma que acabou de começar.
 */
export function activityCold(discussion: Discussion): Heat {
  const created = discussion.createdAt()?.getTime();
  const last = discussion.lastPostedAt()?.getTime();

  if (!created || !last) return null;

  return band((last - created) / DAY, 14, 30, 60);
}
