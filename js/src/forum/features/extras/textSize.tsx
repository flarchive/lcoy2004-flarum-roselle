/*
 * Discourse 界面偏好中的“文本大小”：更小、正常、更大和最大，
 * 位于设置中。
 *
 * 这是设备级选择（手机可能需要比电脑更大的字号），因此保存在
 * localStorage 中而非账户偏好里。它会变成 <html> 上的一个类
 * （`lcoy-text-larger`…），CSS 据此缩放基础字号。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import FieldSet from 'flarum/common/components/FieldSet';
import Select from 'flarum/common/components/Select';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';

const STORAGE_KEY = 'lcoy.textSize';

/** 文本大小 => <html> 上的类。`normal` 不添加任何类。 */
const SIZES = ['smaller', 'normal', 'larger', 'largest'] as const;
type TextSize = (typeof SIZES)[number];

function enabled(): boolean {
  return forumBool('lcoyTextSizeEnabled', true);
}

function stored(): TextSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return (SIZES as readonly string[]).includes(value || '') ? (value as TextSize) : 'normal';
  } catch {
    // localStorage 被禁用（隐私窗口、禁用 Cookie）：使用正常大小。
    return 'normal';
  }
}

function applySize(size: TextSize): void {
  const root = document.documentElement;

  SIZES.forEach((item) => root.classList.remove(`lcoy-text-${item}`));

  if (size !== 'normal') root.classList.add(`lcoy-text-${size}`);
}

function save(size: TextSize): void {
  try {
    if (size === 'normal') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // 无存储时该选择仅持续到刷新——聊胜于无。
  }

  applySize(size);
}

export default function installTextSize(): void {
  // 在 mount 中而非 initializer 中：论坛配置只在其后存在。
  extend(app as any, 'mount', function () {
    if (enabled()) applySize(stored());
  });

  // SettingsPage 按需加载；按路径扩展会等待该模块。
  extend('flarum/forum/components/SettingsPage', 'settingsItems', function (items: ItemList<Mithril.Children>) {
    if (!enabled()) return;

    const options: Record<string, string> = {};
    SIZES.forEach((size) => (options[size] = t(`extras.text_size.${size}`)));

    items.add(
      'lcoyInterface',
      <FieldSet className="Settings-lcoyInterface FieldSet--min" label={t('extras.text_size.heading')}>
        <div className="Form-group LcoyTextSize">
          <label className="LcoyTextSize-label" for="lcoy-text-size">
            {t('extras.text_size.label')}
          </label>
          <Select id="lcoy-text-size" options={options} value={stored()} onchange={(value: TextSize) => save(value)} />
          <p className="helpText">{t('extras.text_size.help')}</p>
        </div>
      </FieldSet>,
      // 位于“设备”（70）与“配色方案”（60）之间。
      65
    );
  });
}
