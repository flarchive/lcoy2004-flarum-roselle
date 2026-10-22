/*
 * Cards do perfil estendido: título, status e aniversário, cada um ligado e
 * desligado aqui.
 *
 * Bio, local e site não têm card: quem cuida é o fof/user-bio e o
 * fof/socialprofile. A capa é a do forumaker/profile-cover.
 */
import { trans } from '../util';
import AdminToggle from '../components/AdminToggle';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.profile';

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const PROFILE_CARDS: CardDef[] = [
  {
    id: 'profile-fields',
    group: 'people',
    icon: 'far fa-id-card',
    title: () => trans(`${KEY}.section_main`, 'Perfil estendido'),
    description: help(
      'profile_enabled',
      'Título, status e aniversário no perfil e no cartão de usuário. Desligado, os campos somem do fórum e da API, mas o que já foi preenchido fica guardado.'
    ),
    keywords: 'perfil profile título title status aniversário birthday campos fields',
    master: 'canela.profile_enabled',
    body: () => (
      <>
        {toggle(
          'profile_birthday',
          'Aniversário',
          'Data de nascimento opcional. Os outros veem só o dia e o mês, a menos que a pessoa escolha mostrar o ano.'
        )}
      </>
    ),
  },
  {
    id: 'profile-title',
    group: 'people',
    icon: 'fas fa-medal',
    title: () => trans(`${KEY}.section_title`, 'Título do usuário'),
    description: help('profile_title', 'Um título curto (até 60 caracteres) no perfil, no cartão e ao lado do nome nos posts.'),
    keywords: 'título title cargo distinção abaixo do nome moderação',
    master: 'canela.profile_title',
    dependsOn: 'canela.profile_enabled',
    body: () =>
      toggle(
        'profile_title_self',
        'Cada pessoa escolhe o próprio título',
        'Desligado, só quem pode editar usuários (a moderação) define títulos, como uma distinção dada pela equipe.'
      ),
  },
  {
    id: 'profile-status',
    group: 'people',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.section_status`, 'Status do usuário'),
    description: help(
      'profile_status',
      'Um emoji e uma frase ("🌴 De férias até sexta") ao lado do nome nos posts, no cartão e no avatar do cabeçalho. A pessoa escolhe quando o status some sozinho.'
    ),
    keywords: 'status emoji férias ausente away ocupado busy limpar expira',
    master: 'canela.profile_status',
    dependsOn: 'canela.profile_enabled',
  },
];

export default PROFILE_CARDS;
