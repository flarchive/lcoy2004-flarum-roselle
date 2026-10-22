/*
 * Cards das estatísticas: o realce da coluna de visualizações, as contagens
 * de Novos/Não lidos (lista) e a atividade do resumo do perfil.
 */
import { trans } from '../util';
import { AdminNotice, AdminSubGroup } from '../components/AdminCard';
import AdminNumber from '../components/AdminNumber';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.stats';

const number = (name: string, range: { min: number; max: number; fallback: number }, label: string, help: string, suffix?: string) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    min={range.min}
    max={range.max}
    fallback={range.fallback}
    suffix={suffix}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help, { min: range.min, max: range.max })}
  />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const STATS_CARDS: CardDef[] = [
  {
    id: 'views',
    group: 'list',
    icon: 'far fa-eye',
    title: () => trans(`${KEY}.section_views`, 'Realce das visualizações'),
    description: help(
      'stats_views_enabled',
      'As cores de calor da coluna Visualizações da lista (heatmap do Discourse). O número em si vem do fof/discussion-views.'
    ),
    keywords: 'visualizações views calor heat heatmap realce highlight topic_views_heat',
    body: () => (
      <AdminSubGroup>
        {number(
          'topic_views_heat_low',
          { min: 1, max: 100000000, fallback: 1000 },
          'Realce leve a partir de',
          'Após uma quantidade de visualizações, o campo de visualizações é levemente realçado. O Discourse usa 1000.',
          trans(`${KEY}.views_suffix`, 'visualizações')
        )}
        {number(
          'topic_views_heat_medium',
          { min: 1, max: 100000000, fallback: 2000 },
          'Realce moderado a partir de',
          'Após esta quantidade de visualizações, o campo de visualizações é moderadamente realçado. O Discourse usa 2000.',
          trans(`${KEY}.views_suffix`, 'visualizações')
        )}
        {number(
          'topic_views_heat_high',
          { min: 1, max: 100000000, fallback: 3500 },
          'Realce forte a partir de',
          'Após esta quantidade de visualizações, o campo de visualizações é fortemente realçado. O Discourse usa 3500.',
          trans(`${KEY}.views_suffix`, 'visualizações')
        )}
      </AdminSubGroup>
    ),
  },
  {
    id: 'counts',
    group: 'list',
    icon: 'fas fa-circle-dot',
    title: () => trans(`${KEY}.section_counts`, 'Contagem de novos e não lidos'),
    description: help(
      'stats_counts_enabled',
      'Para quem entrou na conta: "Novos (3)" e "Não lidos (2)" nas abas da lista, e um ponto ao lado de Todas as Discussões na barra lateral quando há novidade.'
    ),
    keywords: 'novos new não lidos unread contagem count abas tabs ponto dot barra lateral sidebar tópicos topics',
    master: 'canela.stats_counts_enabled',
    body: () =>
      number(
        'stats_new_days',
        { min: 0, max: 365, fallback: 2 },
        'Dias em que uma discussão é nova',
        'Discussões criadas nesse período que a pessoa ainda não abriu. 0 conta tudo desde o cadastro ou o último "marcar tudo como lido". De {min} a {max}; o Discourse usa 2.',
        trans(`${KEY}.days_suffix`, 'dias')
      ),
  },
  {
    id: 'link-clicks',
    group: 'topic',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.section_links`, 'Cliques em links'),
    description: help(
      'stats_links_enabled',
      'Cada clique num link externo de uma postagem é contado, como no Discourse: o número aparece ao lado do link, os "Links populares" no mapa da discussão e os "Melhores links" no resumo do perfil.'
    ),
    keywords: 'links cliques clicks contagem count links populares popular links melhores links top links topic_link_clicks mapa do tópico topic map',
    master: 'canela.stats_links_enabled',
    body: () => (
      <AdminNotice>
        {trans(
          `${KEY}.links_notice`,
          'Um clique por link por pessoa (ou IP, para visitantes) a cada 24 horas; robôs não contam. Só links externos que estão na postagem.'
        )}
      </AdminNotice>
    ),
  },
  {
    id: 'activity',
    group: 'people',
    icon: 'fas fa-chart-simple',
    title: () => trans(`${KEY}.section_activity`, 'Atividade no perfil'),
    description: help(
      'stats_activity_enabled',
      'Dias visitados, tempo de leitura (total e dos últimos 60 dias), postagens lidas e curtidas dadas e recebidas, no resumo do perfil, como no Discourse.'
    ),
    keywords: 'atividade activity resumo summary dias visitados days visited tempo de leitura read time postagens lidas posts read curtidas likes',
    master: 'canela.stats_activity_enabled',
    body: () => (
      <AdminNotice>
        {trans(
          `${KEY}.activity_notice`,
          'O tempo de leitura só conta com a aba visível e alguém mexendo na página. Os números começam do zero no dia em que o recurso é ligado.'
        )}
      </AdminNotice>
    ),
  },
];

export default STATS_CARDS;
