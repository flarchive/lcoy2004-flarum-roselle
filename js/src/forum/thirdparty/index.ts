/*
 * Integração com extensões de terceiros (FriendsOfFlarum) que cobrem
 * recursos do Discourse: cada uma só é tocada se estiver ativa, e nenhum
 * módulo delas é importado direto — vêm do registro do Flarum, com guarda.
 * As chaves do admin (thirdparty/settings.ts) são lidas na hora de desenhar:
 * no initializer o fórum ainda não carregou as configurações.
 *
 * O resto (follow-tags, oauth, terms, formatting, split, merge, ignore) é só
 * visual, em less/forum/thirdparty/.
 *
 * forumaker/profile-cover não tem install: a capa é lida por
 * features/profile/data.ts com `thirdParty.profileCover()`, e o campo das
 * Configurações e o editor estão em ./profileCover.
 */
import installBestAnswer from './bestAnswer';
import installReactions from './reactions';
import installPolls from './polls';
import installLinks from './links';
import installUpload from './upload';
import installThumbnails from './thumbnails';
import installRecommendations from './recommendations';
import installFofWidgets from './fofWidgets';
import { isExtensionEnabled } from '../utils/settings';
// Efeito colateral: desliga a grelha própria do tryhackx/flarum-thumb-sliders
// antes do initializer dele (o tema desenha o slider dentro da linha).
import './thumbSlider';

export default function installThirdParty(): void {
  if (isExtensionEnabled('fof-best-answer')) installBestAnswer();
  if (isExtensionEnabled('fof-reactions')) installReactions();
  if (isExtensionEnabled('fof-polls')) installPolls();
  if (isExtensionEnabled('fof-links')) installLinks();
  if (isExtensionEnabled('fof-upload')) installUpload();
  if (isExtensionEnabled('fof-discussion-thumbnail')) installThumbnails();
  // As três listas da lcoy/recommendations viram uma seção da barra lateral.
  if (isExtensionEnabled('lcoy-recommendations')) installRecommendations();
  // Os widgets do fof/forum-widgets-core saem da coluna da direita e viram
  // seções da barra lateral (a coluna estourava a janela).
  if (isExtensionEnabled('fof-forum-widgets-core')) installFofWidgets();
}
