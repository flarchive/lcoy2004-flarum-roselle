/*
 * Cards dos recursos com backend e das integrações. Cada recurso exporta os
 * seus de ./features/<recurso>.tsx e entra nesta lista; o painel os separa
 * pelo `group` de cada card.
 */
import type { CardDef } from '../types';
import COMMUNITY_CARDS from './community';
import STATS_CARDS from './stats';
import BOOKMARKS_CARDS from './bookmarks';
import COMPOSER_CARDS from './composer';
import EXTRAS_CARDS from './extras';
import PROFILE_CARDS from './profile';
import GAPS_CARDS from './gaps';
import INTEGRATION_CARDS from './integrations';

const FEATURE_CARDS: CardDef[] = [
  ...COMMUNITY_CARDS,
  ...STATS_CARDS,
  ...BOOKMARKS_CARDS,
  ...COMPOSER_CARDS,
  ...EXTRAS_CARDS,
  ...PROFILE_CARDS,
  ...INTEGRATION_CARDS,
  ...GAPS_CARDS,
];

export default FEATURE_CARDS;
