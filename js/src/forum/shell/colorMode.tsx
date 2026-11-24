/*
 * 与 Discourse 相同的侧栏页脚：文本形式的调色板选择器
 * （“默认 ⌄”，如同 Meta 的 “Meta Branded ⌄”）以及颜色模式按钮——太阳、
 * 月亮或半圆——带有 浅色 / 深色 / 自动 菜单
 * （`interface-color-selector`）。
 *
 * Flarum 只保存一个方案（`light`、`dark`、`auto`、`light-hc`、
 * `dark-hc`）；这里它被拆成两个轴：模式和调色板（默认或高
 * 对比度）。核心中没有“自动”加高对比度：该选择
 * 保存在浏览器中，解析后的 `data-theme` 会加上 `-hc`（见
 * `installColorMode`）。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Separator from 'flarum/common/components/Separator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

type Mode = 'light' | 'dark' | 'auto';

const HC_KEY = 'lcoy.highContrast';

const MODE_ICONS: Record<Mode, string> = {
  light: 'fas fa-sun',
  dark: 'fas fa-moon',
  auto: 'fa-solid fa-circle-half-stroke',
};

function storedHighContrast(): boolean {
  try {
    return localStorage.getItem(HC_KEY) === '1';
  } catch {
    return false;
  }
}

function storeHighContrast(value: boolean): void {
  try {
    if (value) localStorage.setItem(HC_KEY, '1');
    else localStorage.removeItem(HC_KEY);
  } catch {
    // 没有存储：仅本次页面访问期间有效。
  }
}

function currentScheme(): string {
  return app.colorScheme ?? app.session.user?.preferences()?.colorScheme ?? app.forum.attribute<string>('colorScheme') ?? 'auto';
}

function currentMode(): Mode {
  const scheme = currentScheme();

  return scheme.startsWith('dark') ? 'dark' : scheme.startsWith('light') ? 'light' : 'auto';
}

function currentHighContrast(): boolean {
  const scheme = currentScheme();

  return scheme === 'auto' ? storedHighContrast() : scheme.endsWith('-hc');
}

/** 像核心的 ThemeSwitcher 保存方案那样保存组合。 */
function apply(mode: Mode, highContrast: boolean): void {
  const scheme = mode === 'auto' ? 'auto' : highContrast ? `${mode}-hc` : mode;

  storeHighContrast(highContrast);
  app.setColorScheme(scheme);

  if (app.session.user) {
    app.session.user.savePreferences({ colorScheme: scheme });
  } else {
    try {
      sessionStorage.setItem('colorScheme', scheme);
    } catch {
      // 浏览器阻止了存储。
    }
  }

  m.redraw();
}

/**
 * “自动”加高对比度：核心把 `auto` 解析为 `light`/`dark`
 * （只在系统要求高对比度时才加上 `-hc`）；这里当用户选择了
 * 高对比度调色板时，也会加上 `-hc`。
 */
let installed = false;

export function installColorMode(): void {
  if (installed) return;
  installed = true;

  extend(app as any, 'setColorScheme', function () {
    if (app.colorScheme !== 'auto' || !storedHighContrast()) return;

    const resolved = document.documentElement.getAttribute('data-theme') || 'light';

    if (!resolved.endsWith('-hc')) document.documentElement.setAttribute('data-theme', `${resolved}-hc`);
  });
}

/** ernestdefoe/wardrobe 提供的一个主题（放在页面 payload 中）。 */
type WardrobeTheme = { id: string; title: string };

type WardrobeData = { themes: WardrobeTheme[]; active: string | null; allowUserChoice: boolean };

/** 与 Wardrobe 相同的 cookie：服务器正是读取它为未登录访客服务。 */
const WARDROBE_COOKIE = 'wardrobe_theme';

/**
 * 可供选择的主题，或没有 Wardrobe 时（或只有一个主题、
 * 或在其后台关闭了用户选择时）为 `null`：此时选择器只剩下
 * 调色板。
 */
function wardrobe(): WardrobeData | null {
  const data = (app.data as any).wardrobe as WardrobeData | undefined;

  return data && data.allowUserChoice && data.themes.length > 1 ? data : null;
}

/**
 * 像 Wardrobe 那样切换主题：有账号的用户保存偏好（在所有
 * 设备上生效），没有账号的写 cookie。然后重新加载：每个主题都有自己的
 * JS 和 CSS，所以打开的页面实际上就是所选主题的代码。
 */
function chooseTheme(id: string): void {
  const user = app.session.user;

  if (!user) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';

    document.cookie = `${WARDROBE_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.reload();

    return;
  }

  user
    .savePreferences({ wardrobeTheme: id })
    .then(() => window.location.reload())
    .catch(() => app.alerts.show({ type: 'error' }, t('sidebar.theme.save_failed')));
}

/**
 * 页脚中的文本选择器，如同 Meta 的 “🖌 Meta Branded ⌄”。有
 * Wardrobe 且主题多于一个时，显示画笔和主题名称，菜单列出
 * 主题；调色板（默认 / 高对比度）放在同一菜单的单独
 * 区块中。没有 Wardrobe 时，就只是调色板选择器，和以前一样。
 */
export class FooterPaletteSelector extends Component {
  view(): Mithril.Children {
    const highContrast = currentHighContrast();
    const palettes = [
      { id: false, label: t('sidebar.palette.default') },
      { id: true, label: t('sidebar.palette.high_contrast') },
    ];
    const current = palettes.find((palette) => palette.id === highContrast)!;
    const themes = wardrobe();
    const activeTheme = themes?.themes.find((theme) => theme.id === themes.active) ?? themes?.themes[0];

    const paletteOptions = palettes.map((palette) => (
      <Button
        className={classList('LcoyPaletteSelector-option', { active: palette.id === highContrast })}
        onclick={() => apply(currentMode(), palette.id)}
      >
        <span className={classList('LcoyPaletteSelector-dot', { 'LcoyPaletteSelector-dot--hc': palette.id })} aria-hidden="true" />
        {palette.label}
      </Button>
    ));

    if (!themes || !activeTheme) {
      return (
        <Dropdown
          className="LcoyPaletteSelector"
          buttonClassName="Button Button--flat LcoyPaletteSelector-toggle"
          menuClassName="LcoyPaletteSelector-menu"
          label={<span className="LcoyPaletteSelector-label">{current.label}</span>}
          caretIcon="fas fa-chevron-down"
          accessibleToggleLabel={t('sidebar.palette.title')}
        >
          {paletteOptions}
        </Dropdown>
      );
    }

    return (
      <Dropdown
        className="LcoyPaletteSelector LcoyPaletteSelector--themes"
        buttonClassName="Button Button--flat LcoyPaletteSelector-toggle"
        menuClassName="LcoyPaletteSelector-menu"
        label={
          <span className="LcoyPaletteSelector-label">
            <Icon name="fas fa-paintbrush" className="LcoyPaletteSelector-brush" />
            {activeTheme.title}
          </span>
        }
        caretIcon="fas fa-chevron-down"
        accessibleToggleLabel={t('sidebar.theme.title')}
      >
        <span className="LcoyPaletteSelector-heading">{t('sidebar.theme.title')}</span>
        {themes.themes.map((theme) => (
          <Button
            className={classList('LcoyPaletteSelector-option', { active: theme.id === activeTheme.id })}
            icon={theme.id === activeTheme.id ? 'fas fa-check' : 'fas fa-paintbrush'}
            onclick={() => theme.id !== activeTheme.id && chooseTheme(theme.id)}
          >
            {theme.title}
          </Button>
        ))}
        <Separator />
        <span className="LcoyPaletteSelector-heading">{t('sidebar.palette.title')}</span>
        {paletteOptions}
      </Dropdown>
    );
  }
}

/** 颜色模式按钮：只有图标，带三个选项的菜单。 */
export class FooterColorMode extends Component {
  view(): Mithril.Children {
    const mode = currentMode();
    const modes: Mode[] = ['light', 'dark', 'auto'];

    return (
      <Dropdown
        className="LcoyColorMode"
        buttonClassName="Button Button--icon Button--flat LcoyColorMode-toggle"
        menuClassName="LcoyColorMode-menu"
        icon={MODE_ICONS[mode]}
        caretIcon=""
        label=""
        accessibleToggleLabel={t('sidebar.color_mode.title')}
      >
        {modes.map((option) => (
          <Button
            className={classList('LcoyColorMode-option', `LcoyColorMode-option--${option}`, { active: option === mode })}
            onclick={() => apply(option, currentHighContrast())}
          >
            <Icon name={MODE_ICONS[option]} className="Button-icon" />
            <span className="Button-label">{t(`sidebar.color_mode.${option}`)}</span>
          </Button>
        ))}
      </Dropdown>
    );
  }
}
