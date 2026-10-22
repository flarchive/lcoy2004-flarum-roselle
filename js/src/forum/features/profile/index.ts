/*
 * Perfil estendido (os campos de perfil do Discourse): título, status com
 * emoji, aniversário e a capa da forumaker/profile-cover.
 *
 * Bio, local e site vêm do fof/user-bio e do fof/socialprofile.
 *
 * - Configurações → seção "Perfil" para editar os próprios campos.
 * - UserCard do core (hero do perfil): título, status, aniversário e as
 *   imagens como variáveis CSS.
 * - Posts: o emoji do status ao lado do nome e o título no cabeçalho.
 * - Cabeçalho: o emoji em selo sobre o avatar da sessão.
 * - "Editar usuário" (moderação): título e limpeza de status.
 *
 * As outras áreas que desenham perfis próprios (o cartão do tópico) usam as
 * peças de ./components e os dados de ./data, que já respeitam o admin.
 */
import { installEditUserModal, installPostUser, installSessionStatus, installUserCard } from './integrations';
import installSettingsPage from './settingsPage';

export function installExtendedProfile() {
  installSettingsPage();
  installUserCard();
  installPostUser();
  installSessionStatus();
  installEditUserModal();
}

export default installExtendedProfile;

export * from './data';
export { BirthdayFact, ProfileCardExtras, StatusEmoji, StatusLine, TitleLine, profileImageStyle } from './components';
