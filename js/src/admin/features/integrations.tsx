/*
 * Cards das extensões de terceiros que o tema adapta (js/src/forum/thirdparty).
 * Cada uma só vale com a extensão ligada: sem ela o card fica trancado, com
 * "Precisa da extensão X". As chaves são as `canela.thirdparty_*` do extend.php.
 */
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.integrations';

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const cards: CardDef[] = [
  {
    id: 'thirdparty-solved',
    group: 'integrations',
    icon: 'far fa-square-check',
    title: () => trans(`${KEY}.solved_label`, 'Solução aceita'),
    description: help('solved', 'O "✓ Solução" na barra da postagem e a resposta aceita logo abaixo do primeiro post, como o discourse-solved.'),
    keywords: 'solução solved melhor resposta best answer aceita accepted fof',
    master: 'canela.thirdparty_solved',
    extensions: ['fof-best-answer'],
  },
  {
    id: 'thirdparty-reactions',
    group: 'integrations',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.reactions_label`, 'Reações'),
    description: help('reactions', 'O resumo dos emoji na barra da postagem, como o discourse-reactions.'),
    keywords: 'reações reactions emoji curtir like fof',
    master: 'canela.thirdparty_reactions',
    extensions: ['fof-reactions'],
  },
  {
    id: 'thirdparty-polls',
    group: 'integrations',
    icon: 'fas fa-square-poll-horizontal',
    title: () => trans(`${KEY}.polls_label`, 'Enquetes'),
    description: help('polls', 'As enquetes com a grade do poll do Discourse: as barras de resultado e a contagem grande de votos ao lado.'),
    keywords: 'enquetes polls votação votos votes fof',
    master: 'canela.thirdparty_polls',
    extensions: ['fof-polls'],
  },
  {
    id: 'thirdparty-links',
    group: 'integrations',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.links_sidebar_label`, 'Links na barra lateral'),
    description: help(
      'links_sidebar',
      'Os links do FoF Links saem do cabeçalho e vão para uma seção da barra lateral, como os links personalizados do Discourse.'
    ),
    keywords: 'links fof barra lateral sidebar cabeçalho header navegação',
    master: 'canela.thirdparty_links_sidebar',
    dependsOn: 'canela.sidebar_enabled',
    extensions: ['fof-links'],
  },
  {
    id: 'thirdparty-upload',
    group: 'integrations',
    icon: 'fas fa-cloud-arrow-up',
    title: () => trans(`${KEY}.upload_progress_label`, 'Progresso do envio'),
    description: help('upload_progress', 'A barra "Enviando…" no editor enquanto um arquivo do FoF Upload sobe, como no Discourse.'),
    keywords: 'upload envio enviar arquivo file progresso progress barra fof',
    master: 'canela.thirdparty_upload_progress',
    extensions: ['fof-upload'],
  },
  {
    id: 'thirdparty-thumbnails',
    group: 'integrations',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.thumbnails_label`, 'Miniaturas na lista'),
    description: help(
      'thumbnails',
      'A miniatura do FoF Discussion Thumbnail ao lado do título na lista de discussões, no lugar onde o Discourse mostra a dele.'
    ),
    keywords: 'miniatura thumbnail imagem image lista list tópico fof',
    master: 'canela.thirdparty_thumbnails',
    extensions: ['fof-discussion-thumbnail'],
  },
  {
    id: 'thirdparty-profile-cover',
    group: 'integrations',
    icon: 'fas fa-panorama',
    title: () => trans(`${KEY}.profile_cover_label`, 'Capa do perfil (forumaker/profile-cover)'),
    description: help(
      'profile_cover',
      'A capa da extensão no lugar da capa interna do tema: na faixa do perfil, no fundo do cartão do usuário (na miniatura, quando existe) e na posição escolhida no editor dela, que abre pelo menu "…" do perfil e pelas Configurações. As imagens internas ficam guardadas e voltam se esta chave for desligada.'
    ),
    keywords: 'capa cover perfil profile imagem image fundo background cartão card forumaker posição position miniatura thumbnail',
    master: 'canela.thirdparty_profile_cover',
    extensions: ['forumaker-profile-cover'],
  },
];

export default cards;
