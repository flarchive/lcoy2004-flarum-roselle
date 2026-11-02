/*
 * 带后端的功能和集成的卡片。每个功能从
 * ./features/<功能>.tsx 导出自己的卡片并加入此列表；
 * 面板按每张卡片的 `group` 将它们分开。
 */
import type { CardDef } from '../types';
import COMMUNITY_CARDS from './community';
import STATS_CARDS from './stats';
import BOOKMARKS_CARDS from './bookmarks';
import COMPOSER_CARDS from './composer';
import EXTRAS_CARDS from './extras';
import GAPS_CARDS from './gaps';
import INTEGRATION_CARDS from './integrations';

const FEATURE_CARDS: CardDef[] = [
  ...COMMUNITY_CARDS,
  ...STATS_CARDS,
  ...BOOKMARKS_CARDS,
  ...COMPOSER_CARDS,
  ...EXTRAS_CARDS,
  ...INTEGRATION_CARDS,
  ...GAPS_CARDS,
];

export default FEATURE_CARDS;
