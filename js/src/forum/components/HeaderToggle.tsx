import Component from 'flarum/common/Component';

import { t } from '../utils/settings';
import { menuIcon } from '../utils/shellIcons';
import { isSidebarOpen, toggleSidebar } from '../utils/sidebarState';

/**
 * Discourse 的汉堡菜单：在平板和桌面端位于徽标左侧，用于
 * 打开和关闭内嵌侧栏；在手机上位于右侧，用于打开面板。
 */
export default class HeaderToggle extends Component {
  view() {
    const open = isSidebarOpen();

    return (
      <button
        type="button"
        className="LcoyHeader-toggle Button Button--icon Button--flat"
        aria-label={t('sidebar.toggle')}
        title={t('sidebar.toggle')}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="lcoy-sidebar"
        onclick={() => toggleSidebar()}
      >
        {menuIcon()}
      </button>
    );
  }
}
