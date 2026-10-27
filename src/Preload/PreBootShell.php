<?php

declare(strict_types=1);

/*
 * This file is part of lcoy/roselle.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 * Copyright (c) 2026 lcoy
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Lcoy\Roselle\Preload;

use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;
use Lcoy\Roselle\Theme\FontFamily;

/**
 * 首次绘制时就呈现主题外壳。
 *
 * Flarum 返回的 HTML 中 `#app` 是原始的，外壳类名（`.Lcoy`、
 * 侧边栏展开、胶囊按钮……）要等 JS 挂载后才加入——在此之前浏览器已经
 * 绘制了无样式的页头和缺少侧边栏空间的内容，随后在启动时全部跳动
 * （每次首次加载的 CLS 约为 0.13）。
 *
 * 一个放在 `<head>` 中的极简脚本监听解析过程，一旦页头出现，就应用与
 * `installShell()` 相同的类名，并创建空的页头插槽（汉堡按钮和中部），
 * 由 JS 后续复用。侧边栏展开或收起遵循与 `sidebarState.ts` 相同的规则：
 * 优先使用 localStorage 中保存的选择，否则用管理员默认值；仅在平板及以上
 * 尺寸生效。
 *
 * 主题字体（latin）也通过 `<link rel="preload">` 预加载：否则它会在启动
 * 之后才到达，字体切换会让选项卡栏折成两行、把列表向下挤（登录状态下
 * 首页的 CLS 约为 0.09）。
 */
final class PreBootShell
{
    /** 每个字族的 latin 文件（latin-ext 仅在页面需要时才下载）。 */
    private const FONT_FILES = [
        FontFamily::INTER => 'inter-latin-wght-normal.woff2',
        FontFamily::JAKARTA => 'plus-jakarta-sans-latin-wght-normal.woff2',
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $attrs = $document->getForumApiDocument()['data']['attributes'] ?? [];

        if (! is_array($attrs)) {
            return;
        }

        // 与 JS 中 `forumBool()` 的读取方式相同：缺失或为 null 时使用默认值。
        $bool = static fn (string $name, bool $default): bool => isset($attrs[$name]) ? (bool) $attrs[$name] : $default;

        $sidebar = $bool('lcoySidebarEnabled', true);
        $classes = array_keys(array_filter([
            'Lcoy' => true,
            'Lcoy--pillButtons' => $bool('lcoyPillButtons', true),
            'Lcoy--tinted' => $bool('lcoyTintedBackground', true),
            'Lcoy--card' => $bool('lcoyContentCard', true),
            'Lcoy--noSidebar' => ! $sidebar,
            'Lcoy--headerSearch' => $bool('lcoyHeaderSearch', true),
            'Lcoy--noEventPosts' => ! $bool('lcoyTopicEventPosts', false),
            // 连接各头像的时间线（less/forum/PostDirect.less）。
            'Lcoy--postDirect' => ($attrs['lcoyPostStyle'] ?? null) === 'direct',
        ]));

        $config = json_encode([
            'classes' => $classes,
            'sidebar' => $sidebar,
            'open' => $bool('lcoySidebarOpenDefault', true),
            'logoOnly' => ! $bool('lcoyShowTitleWithLogo', false),
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

        $font = self::FONT_FILES[(new FontFamily())($this->settings->get(FontFamily::SETTING))] ?? null;
        $assets = $attrs['assetsBaseUrl'] ?? null;

        if ($font !== null && is_string($assets) && $assets !== '') {
            $document->preloads[] = [
                'href' => rtrim($assets, '/').'/extensions/lcoy-roselle/fonts/'.$font,
                'as' => 'font',
                'type' => 'font/woff2',
                'crossorigin' => '',
            ];
        }

        $document->head[] = '<script>'.str_replace('__CONFIG__', (string) $config, self::SCRIPT).'</script>';

        // 核心置于 <head> 的脚本只能依据服务端已知的偏好决定模式；选择了
        // 浅色/深色的访客会把选择保存在 sessionStorage 中，而核心只在 JS
        // 启动时读取。否则页面会先按系统模式绘制，随后再切换（深色 → 浅色）。
        // 后台选择的内容卡片宽度在首次绘制前应用（若在 JS 中应用，卡片会在
        // 启动后改变尺寸）。接受 px（960–1800）或 "90%"、"100%" 两个选项
        // （全宽）。
        $raw = trim((string) $this->settings->get('lcoy.content_width'));
        $width = match (true) {
            $raw === '90%', $raw === '100%' => $raw,
            ctype_digit($raw) && (int) $raw >= 960 && (int) $raw <= 1800 && (int) $raw !== 1110 => ((int) $raw).'px',
            default => null,
        };

        if ($width !== null) {
            $document->head[] = '<style>:root{--lcoy-main-max:'.$width.'}</style>';
        }

        // 与核心一致，访客的选择仅在论坛默认设置为 "auto" 时生效。
        if (($this->settings->get('color_scheme') ?? 'auto') === 'auto') {
            $document->head[] = '<script>'.self::THEME_SCRIPT.'</script>';
        }
    }

    /** 与核心的 initColorScheme() 在启动时、首次绘制前所做的一致。 */
    private const THEME_SCRIPT = <<<'JS'
(function () {
  try {
    var d = document.documentElement;
    if (!d.classList.contains('guest-user')) return;
    var s = sessionStorage.getItem('colorScheme');
    if (!s) return;
    if (s === 'auto') {
      s = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (matchMedia('(prefers-contrast: more)').matches || localStorage.getItem('lcoy.highContrast') === '1') s += '-hc';
    }
    d.setAttribute('data-theme', s);
  } catch (e) {}
})();
JS;

    /** 无依赖且具备容错能力：最坏情况下页面保持原样。 */
    private const SCRIPT = <<<'JS'
(function (c) {
  try {
    var open = false;
    if (c.sidebar && window.matchMedia('(min-width: 768px)').matches) {
      var stored = null;
      try { stored = localStorage.getItem('lcoy.sidebarOpen'); } catch (e) {}
      open = stored === null ? c.open : stored === '1';
    }
    var apply = function () {
      var app = document.getElementById('app');
      var header = document.querySelector('#header > .container');
      var secondary = document.getElementById('header-secondary');
      if (!app || !header || !secondary) return false;
      app.classList.add.apply(app.classList, c.classes.concat(open ? ['Lcoy--sidebarOpen'] : []));
      if (c.logoOnly) header.classList.add('LcoyHeader--logoOnly');
      var title = header.querySelector('.Header-title');
      if (c.sidebar && title && !header.querySelector('.LcoyHeader-toggleSlot')) {
        var toggle = document.createElement('div');
        toggle.className = 'LcoyHeader-toggleSlot';
        header.insertBefore(toggle, title);
      }
      if (!header.querySelector('.LcoyHeader-center')) {
        var center = document.createElement('div');
        center.className = 'LcoyHeader-search LcoyHeader-center';
        header.insertBefore(center, secondary);
      }
      return true;
    };
    var observer = new MutationObserver(function () { if (apply()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { observer.disconnect(); });
  } catch (e) {}
})(__CONFIG__);
JS;
}
