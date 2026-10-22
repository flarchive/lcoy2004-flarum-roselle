/*
 * Os ícones das abas e do rodapé do menu do usuário. O Meta (Horizon) os
 * desenha com o Lucide — traço de 2px, pontas redondas —, que o Font Awesome
 * do Flarum não tem com o mesmo traço. A classe base `.CanelaIcon` (da casca,
 * Header.less) dá o traço; o tamanho vem do UserMenu.less.
 */
import type Mithril from 'mithril';

import { lucideSvg } from '../icons';

// Nome da aba → desenho do Lucide (icons/glyphs.ts, os mesmos do sprite do Meta).
const PATHS: Record<string, string> = {
  bell: 'bell',
  reply: 'reply',
  heart: 'heart',
  mail: 'mail',
  bookmark: 'bookmark',
  // O "discourse-other-tab" do Discourse: uma grade 2×2.
  other: 'grid-2x2',
  flag: 'flag',
  user: 'user',
  chevronDown: 'chevron-down',
  check: 'check',
};

export function menuIcon(name: string): Mithril.Children {
  const glyph = PATHS[name];

  return glyph ? lucideSvg(`CanelaIcon CanelaIcon--${name}`, glyph) : null;
}
