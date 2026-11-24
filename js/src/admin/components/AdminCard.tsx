/*
 * 面板卡片和内容区的基础布局组件。它们是带 `view` 的普通对象
 * （Mithril 接受的组件形式），类型标为 `any` 以便 JSX
 * 接受它们。
 *
 * 功能卡片的状态（带 `master` 的 CardDef）：
 * - 开启：标题栏开关打开，内容可见；
 * - 关闭：只有标题栏（标题、作用、开关）——内容消失；
 * - 锁定：缺少某个扩展（或其他必要条件）；开关被锁住，
 *   原因显示在内容的位置。
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';

import type { CardDef } from '../types';
import { extensionInstalled, extensionName, getBool, missingExtension, trans } from '../util';
import { AdminSwitch } from './AdminSwitch';
import { setBool } from './AdminToggle';

const KEY = 'lcoy-roselle.admin.settings.shell';

/** 卡片被锁定的原因，或 `null`。 */
export const lockReason = (card: CardDef): { text: string; extension?: string } | null => {
  const missing = missingExtension(card.extensions);
  if (missing) {
    return {
      extension: missing,
      text: extensionInstalled(missing)
        ? trans(`${KEY}.extension_disabled`, '需要 {name} 扩展，该扩展已安装但未启用。', { name: extensionName(missing) })
        : trans(`${KEY}.extension_missing`, '需要 {name} 扩展，但该扩展尚未安装。', { name: extensionName(missing) }),
    };
  }

  const reason = card.lockedBy?.() ?? null;

  return reason ? { text: reason } : null;
};

let savingMaster: string | null = null;

export const AdminCard: any = {
  view({ attrs: { card, groupLabel } }: { attrs: { card: CardDef; groupLabel?: string } }) {
    const lock = lockReason(card);
    const hasMaster = !!card.master;
    const on = hasMaster ? !lock && getBool(card.master!) : !lock;
    const titleId = `LcoyAdmin-card-${card.id}-title`;
    const descId = `LcoyAdmin-card-${card.id}-desc`;
    const body = on && card.body ? card.body() : null;

    return (
      <section
        id={`LcoyAdmin-card-${card.id}`}
        className={`LcoyAdmin-card${hasMaster ? ' is-feature' : ''}${hasMaster && !on ? ' is-off' : ''}${lock ? ' is-locked' : ''}${body ? '' : ' is-empty'}`}
        aria-labelledby={titleId}
      >
        <header className="LcoyAdmin-card-header">
          <span className="LcoyAdmin-card-icon">
            <i className={card.icon} aria-hidden="true" />
          </span>
          <div className="LcoyAdmin-card-heading">
            <h3 className="LcoyAdmin-card-title" id={titleId}>
              {card.title()}
              {groupLabel && <span className="LcoyAdmin-card-group">{groupLabel}</span>}
            </h3>
            {card.description && (
              <p className="LcoyAdmin-card-desc" id={descId}>
                {card.description()}
              </p>
            )}
          </div>
          <span className="LcoyAdmin-card-saved" aria-live="polite">
            <i className="fas fa-check" aria-hidden="true" />
            {trans(`${KEY}.saved`, '已保存')}
          </span>
          {hasMaster && (
            <div className="LcoyAdmin-card-master">
              <span className="LcoyAdmin-card-state">
                {lock ? trans(`${KEY}.locked`, '不可用') : on ? trans(`${KEY}.on`, '开启') : trans(`${KEY}.off`, '关闭')}
              </span>
              <AdminSwitch
                state={on}
                disabled={!!lock}
                saving={savingMaster === card.master}
                label={card.title()}
                describedBy={card.description ? descId : undefined}
                onchange={(checked: boolean) => {
                  savingMaster = card.master!;
                  setBool(card.master!, checked).finally(() => {
                    savingMaster = null;
                    m.redraw();
                  });
                }}
              />
            </div>
          )}
        </header>

        {lock && (
          <div className="LcoyAdmin-card-lock">
            <i className={lock.extension ? 'fas fa-plug-circle-xmark' : 'fas fa-lock'} aria-hidden="true" />
            <span>{lock.text}</span>
            {lock.extension && extensionInstalled(lock.extension) && (
              <Link className="LcoyAdmin-card-lockLink" href={app.route('extension', { id: lock.extension })}>
                {trans(`${KEY}.open_extension`, '打开该扩展')}
              </Link>
            )}
          </div>
        )}

        {body && <div className="LcoyAdmin-card-body">{body}</div>}
      </section>
    );
  },
};

/** 卡片内的高亮提示：依赖项、副作用。 */
export const AdminNotice: any = {
  view({ attrs: { icon = 'fas fa-circle-info' }, children }: any) {
    return (
      <p className="LcoyAdmin-notice">
        <i className={icon} aria-hidden="true" />
        <span>{children}</span>
      </p>
    );
  },
};

export const SubDivider: any = {
  view() {
    return <div className="LcoyAdmin-subDivider" />;
  },
};

/** 依赖上方选项的选项，缩进在一个块中。 */
export const AdminSubGroup: any = {
  view({ children }: any) {
    return <div className="LcoyAdmin-subGroup">{children}</div>;
  },
};
