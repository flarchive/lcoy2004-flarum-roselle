/*
 * 一个自动保存的开关选项。
 *
 * - `dependsOn`：必须成立的键；缺少它们时该选项会消失（而不是
 *   仅被禁用）——面板的要求是不成立的选项不显示。
 * - `extension`：缺少该扩展时选项不起作用；没有它时选项
 *   仍然可见但被锁定，并显示“需要扩展 X”——以便知道它
 *   存在以及缺少什么。
 */
import app from 'flarum/admin/app';
import { AdminComponent, extensionName, firstOff, getBool, missingExtension, registerDeps, saveSetting, toList, trans } from '../util';
import { AdminSwitch } from './AdminSwitch';

/**
 * 立即切换（面板会重绘依赖项）并保存。如果保存失败，
 * 开关会回到之前的值：面板不能把服务器未保存的内容
 * 显示为已开启。
 */
export const setBool = (settingKey: string, checked: boolean) => {
  const previous = app.data.settings[settingKey];
  app.data.settings[settingKey] = checked ? '1' : '0';
  m.redraw();

  return saveSetting({ [settingKey]: checked ? '1' : '0' }).catch(() => {
    app.data.settings[settingKey] = previous;
    m.redraw();
  });
};

export const ExtensionBadge: any = {
  view({ attrs: { id } }: any) {
    return (
      <span className="LcoyAdmin-extBadge">
        <i className="fas fa-plug-circle-xmark" aria-hidden="true" />
        {trans('lcoy-roselle.admin.settings.shell.requires_extension', '需要 {name} 扩展', { name: extensionName(id) })}
      </span>
    );
  },
};

export default class AdminToggle extends AdminComponent {
  saving = false;

  view() {
    const { settingKey, label, help, dependsOn, extension } = this.attrs;
    const deps = toList(dependsOn);
    const extensions = toList(extension);

    if (deps.length || extensions.length) registerDeps(settingKey, { deps, extensions });
    if (firstOff(deps)) return null;

    const missing = missingExtension(extensions);
    const id = `LcoyAdmin-${String(settingKey).replace(/\W+/g, '-')}`;

    return (
      <div className={`Form-group LcoyAdmin-toggle${missing ? ' is-locked' : ''}`}>
        <div className="LcoyAdmin-toggleRow">
          <label className="LcoyAdmin-toggleLabel" for={id}>
            {label}
            {missing && <ExtensionBadge id={missing} />}
          </label>
          <AdminSwitch
            id={id}
            state={!missing && getBool(settingKey)}
            disabled={!!missing}
            saving={this.saving}
            describedBy={help ? `${id}-help` : undefined}
            onchange={(checked: boolean) => {
              this.saving = true;
              setBool(settingKey, checked).finally(() => {
                this.saving = false;
                m.redraw();
              });
            }}
          />
        </div>
        {help && (
          <p className="helpText" id={`${id}-help`}>
            {help}
          </p>
        )}
      </div>
    );
  }
}
