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

namespace Lcoy\Roselle\Theme\Loader;

use DOMDocument;
use DOMElement;
use Flarum\Settings\SettingsRepositoryInterface;
use Lcoy\Roselle\Theme\Logo\SvgSanitizer;

/**
 * 加载指示器的 LESS 变量（less/forum/Loader.less）。
 *
 * SVG 以 `data:` 的形式写入论坛样式表——而不是每页的 payload：样式表本就
 * 只下载一次并缓存，这样指示器对 `#flarum-loading` 也生效，而它在 JS
 * 之前就会出现。
 *
 * 每个值从这里输出时已可直接用于 `@config-…: <值>;`。任何超出预期的值
 * 都会变成 Flarum 的默认值：这里一个坏值会让整个样式表编译失败。
 */
final class LoaderLess
{
    public const STYLE = 'lcoy.loader_style';
    public const CUSTOM = 'lcoy.loader_custom';
    public const TINT = 'lcoy.loader_tint';
    public const COLOR = 'lcoy.loader_color';
    public const SIZE = 'lcoy.loader_size';

    /** 自定义 SVG 清理后的大小上限：它会进入论坛样式表。 */
    public const MAX_BYTES = 65536;

    public const SIZE_MIN = 50;
    public const SIZE_MAX = 250;

    /** 开启加载动画的替换（`@config-lcoy-loader-on`）。 */
    public static function on(mixed $value): string
    {
        return self::image() === 'none' ? 'false' : 'true';
    }

    /** SVG 以 `url(data:…)` 形式输出，或为 `none`（`@config-lcoy-loader-image`）。 */
    public static function image(): string
    {
        return self::dataUrl(false);
    }

    /**
     * 同一图形的静止版本，用于 `prefers-reduced-motion`
     * （`@config-lcoy-loader-still`）。仅在 SVG 内写 `@media` 不够：
     * 对于 CSS 中的图片，浏览器并不总会评估它，而 SMIL 更是不会读取它。
     */
    public static function still(): string
    {
        return self::dataUrl(true);
    }

    private static function dataUrl(bool $still): string
    {
        try {
            $style = self::style();

            $svg = match (true) {
                $style === LoaderPresets::CUSTOM => self::clean((string) self::setting(self::CUSTOM, ''), $still),
                isset(LoaderPresets::SVG[$style]) => self::prepare(LoaderPresets::SVG[$style], $still),
                default => null,
            };

            return $svg === null ? 'none' : '~"url(data:image/svg+xml;base64,'.base64_encode($svg).')"';
        } catch (\Throwable) {
            return 'none';
        }
    }

    /**
     * 用指示器的颜色绘制（遮罩），或保留 SVG 自身的颜色
     * （`@config-lcoy-loader-tint`）。预置图形都是单色的，因此该选择只对
     * 自定义 SVG 有效。
     */
    public static function tint(mixed $value): string
    {
        if (self::style() !== LoaderPresets::CUSTOM) {
            return 'true';
        }

        return $value === null || $value === '' || (bool) $value ? 'true' : 'false';
    }

    /** 所选的十六进制颜色或主题的强调色（`@config-lcoy-loader-color`）。 */
    public static function color(mixed $value): string
    {
        $color = trim((string) $value);

        return preg_match('/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color) === 1 ? $color : '~"var(--lcoy-accent)"';
    }

    /** 相对 Flarum 尺寸的倍数（`@config-lcoy-loader-scale`）。 */
    public static function scale(mixed $value): string
    {
        $percent = is_numeric($value) ? (int) $value : 100;
        $percent = max(self::SIZE_MIN, min(self::SIZE_MAX, $percent));

        return rtrim(rtrim(number_format($percent / 100, 2, '.', ''), '0'), '.');
    }

    /**
     * 清理自定义 SVG：沿用 logo 的允许列表（含 SMIL 动画）、大小上限、
     * 缺失的 `viewBox`，以及动效限制。
     */
    public static function clean(string $raw, bool $still = false): ?string
    {
        $raw = trim($raw);

        if ($raw === '' || strlen($raw) > self::MAX_BYTES * 2) {
            return null;
        }

        $svg = SvgSanitizer::sanitize($raw, true);

        if ($svg === null || strlen($svg) > self::MAX_BYTES) {
            return null;
        }

        return self::prepare($svg, $still);
    }

    /**
     * 确保存在 `viewBox`（没有它，图形无法跟随遮罩的尺寸），并在开头
     * 加入能让 SVG 自身 CSS 动画停止的 `prefers-reduced-motion`：页面 CSS
     * 无法从外部作用于图片内部运行的内容。在静止版本（`$still`）中，
     * 动画被彻底移除：CSS 动画通过一条规则去除，SMIL 动画则通过删除元素。
     */
    private static function prepare(string $svg, bool $still = false): ?string
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($svg, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->documentElement;

        if (! $loaded || ! $root instanceof DOMElement) {
            return null;
        }

        $width = (float) $root->getAttribute('width');
        $height = (float) $root->getAttribute('height');

        if (! $root->hasAttribute('viewBox') && $width > 0 && $height > 0) {
            $root->setAttribute('viewBox', sprintf('0 0 %s %s', $width, $height));
        }

        // 固定的宽度和高度改为指示器盒子的大小。
        $root->removeAttribute('width');
        $root->removeAttribute('height');

        if ($still) {
            foreach (['animate', 'animateTransform', 'animateMotion', 'set'] as $tag) {
                foreach (iterator_to_array($document->getElementsByTagNameNS('*', $tag)) as $node) {
                    $node->parentNode?->removeChild($node);
                }
            }
        }

        $style = $document->createElementNS('http://www.w3.org/2000/svg', 'style');
        $style->textContent = $still ? '*{animation:none!important}' : '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
        $root->insertBefore($style, $root->firstChild);

        return $document->saveXML($root) ?: null;
    }

    private static function style(): string
    {
        $style = (string) self::setting(self::STYLE, LoaderPresets::DEFAULT);

        return in_array($style, LoaderPresets::keys(), true) ? $style : LoaderPresets::DEFAULT;
    }

    /**
     * 由容器即时读取：在核心保存时所做的测试编译中，仓库已经持有新值。
     */
    private static function setting(string $key, mixed $default): mixed
    {
        return resolve(SettingsRepositoryInterface::class)->get($key, $default);
    }
}
