/*
 * Chaves do admin para a integração com extensões de terceiros. Todas valem
 * `true` até o servidor dizer o contrário, então a integração funciona mesmo
 * antes de a configuração existir no extend.php.
 */
import { forumBool, isExtensionEnabled } from '../utils/settings';

export const thirdParty = {
  /** fof/best-answer: "✓ Solução" na barra do post e a resposta aceita sob o 1º post. */
  solved: () => isExtensionEnabled('fof-best-answer') && forumBool('canelaThirdPartySolved', true),
  /** fof/reactions: resumo dos emojis na barra do post, como o discourse-reactions. */
  reactions: () => isExtensionEnabled('fof-reactions') && forumBool('canelaThirdPartyReactions', true),
  /** fof/polls: a grade do poll do Discourse, com a contagem grande ao lado. */
  polls: () => isExtensionEnabled('fof-polls') && forumBool('canelaThirdPartyPolls', true),
  /** fof/links: os links saem do cabeçalho e vão para a barra lateral. */
  linksSidebar: () => isExtensionEnabled('fof-links') && forumBool('canelaThirdPartyLinksSidebar', true),
  /** fof/upload: a barra "Enviando…" no editor. */
  uploadProgress: () => isExtensionEnabled('fof-upload') && forumBool('canelaThirdPartyUploadProgress', true),
  /** fof/discussion-thumbnail: a miniatura na lista de tópicos. */
  thumbnails: () => isExtensionEnabled('fof-discussion-thumbnail') && forumBool('canelaThirdPartyThumbnails', true),
  /**
   * forumaker/profile-cover: a capa da extensão no lugar da interna do tema
   * (perfil, cartão e o editor dela nas Configurações). A interna fica no banco.
   */
  profileCover: () => isExtensionEnabled('forumaker-profile-cover') && forumBool('canelaThirdPartyProfileCover', true),
  /**
   * lcoy/recommendations: as três listas (推荐 / 最新 / 最多浏览) na seção
   * "推荐" da barra lateral, no lugar do widget do fof/forum-widgets-core.
   * Sem a barra lateral não há onde pôr a seção, e o widget fica com a extensão.
   */
  recommendationsSidebar: () => isExtensionEnabled('lcoy-recommendations') && forumBool('canelaSidebarEnabled', true),
};

/**
 * Módulo de uma extensão que pode estar desligada: nunca um `import` direto,
 * que quebraria o tema inteiro sem ela.
 */
export function extModule<T = any>(namespace: string, id: string): T | null {
  if (!isExtensionEnabled(namespace)) return null;

  return ((flarum as any).reg.checkModule(namespace, id) as T) || null;
}
