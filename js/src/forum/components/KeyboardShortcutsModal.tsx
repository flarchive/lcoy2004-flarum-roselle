import Modal from 'flarum/common/components/Modal';
import Stream from 'flarum/common/utils/Stream';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { SHORTCUT_GROUPS, type Shortcut } from '../shell/shortcuts';

/** 按键名称，与 Discourse 的 `d-shortcut` 写法一致。 */
const KEY_NAMES: Record<string, string> = {
  shift: 'Shift',
  ctrl: 'Ctrl',
  alt: 'Alt',
  meta: 'Meta',
  enter: 'Enter',
  home: 'Home',
  end: 'End',
  esc: 'Esc',
};

/** "g h" → ["G", "H"]；"shift+j" → ["Shift", "J"]。 */
function keyParts(combo: string): string[] {
  return combo
    .split(/[\s+]+/)
    .filter(Boolean)
    .map((key) => KEY_NAMES[key.toLowerCase()] || (key.length === 1 ? key.toUpperCase() : key));
}

/**
 * Discourse 的快捷键弹窗（`keyboard-shortcuts-modal`），按 “?”
 * 键打开：顶部有搜索框，下方分两列，每个分组一个框，
 * 左侧是描述，右侧是胶囊状的按键。主体在弹窗内部滚动
 * （高度的 80%），而不是把页面撑高。
 */
export default class KeyboardShortcutsModal extends Modal {
  filter = Stream('');

  className() {
    return 'LcoyShortcutsModal Modal--large';
  }

  title() {
    return t('shortcuts.title');
  }

  onready() {
    this.$('.LcoyShortcuts-filter').trigger('focus');
  }

  matches(shortcut: Shortcut, needle: string): boolean {
    if (!needle) return true;

    const label = String(t(`shortcuts.actions.${shortcut.action}`)).toLowerCase();
    const keys = shortcut.keys.map((combo) => keyParts(combo).join(' ').toLowerCase());

    return label.includes(needle) || keys.some((combo) => combo.includes(needle));
  }

  content(): Mithril.Children {
    const needle = this.filter().trim().toLowerCase();
    const groups = SHORTCUT_GROUPS.map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((shortcut) => this.matches(shortcut, needle)),
    })).filter((group) => group.shortcuts.length > 0);

    return (
      <div className="Modal-body">
        <div className="LcoyShortcuts-search">
          <input className="FormControl LcoyShortcuts-filter" type="search" bidi={this.filter} placeholder={t('shortcuts.search_placeholder')} />
        </div>
        {groups.length ? (
          <div className="LcoyShortcuts">
            {groups.map((group) => (
              <section className="LcoyShortcuts-group">
                <h4>{t(`shortcuts.groups.${group.name}`)}</h4>
                <table>
                  <tbody>
                    {group.shortcuts.map((shortcut) => (
                      <tr>
                        <td className="LcoyShortcuts-label">{t(`shortcuts.actions.${shortcut.action}`)}</td>
                        <td className="LcoyShortcuts-keys">
                          {shortcut.keys.map((combo, index) => [
                            index > 0 && (
                              <span className="LcoyShortcuts-or">{/next_prev|first_last/.test(shortcut.action) ? '/' : t('shortcuts.or')}</span>
                            ),
                            <kbd className="LcoyShortcuts-kbd">
                              {keyParts(combo).map((key) => (
                                <span className="LcoyShortcuts-key">{key}</span>
                              ))}
                            </kbd>,
                          ])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        ) : (
          <p className="LcoyShortcuts-empty">{t('shortcuts.no_results')}</p>
        )}
      </div>
    );
  }
}
