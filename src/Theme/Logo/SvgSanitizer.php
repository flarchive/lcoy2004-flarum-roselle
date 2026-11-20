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

namespace Lcoy\Roselle\Theme\Logo;

use DOMDocument;
use DOMElement;

/**
 * 在管理员上传的 SVG 变成公开文件之前对其进行清理。
 *
 * 采用允许列表而非阻止列表：只保留绘图元素和不执行任何操作的属性。
 * 脚本、`foreignObject`、事件（`on*`）、外部链接（不是 `#id` 或 `data:`
 * 中栅格图片的 `href`）以及外部 `url()`/`@import` 都会被移除。不含 DTD
 * 和实体。
 */
final class SvgSanitizer
{
    private const ELEMENTS = [
        'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'metadata',
        'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
        'text', 'tspan', 'textpath', 'image', 'clippath', 'mask', 'pattern', 'marker',
        'lineargradient', 'radialgradient', 'stop', 'filter', 'style',
        'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite', 'feflood',
        'fegaussianblur', 'femerge', 'femergenode', 'feoffset', 'fedropshadow',
        'fefunca', 'fefuncb', 'fefuncg', 'fefuncr', 'femorphology', 'feturbulence',
    ];

    /**
     * 声明式动画（SMIL），仅在调用方要求时允许：加载指示器会变成 CSS 中的
     * 图片（那里不会执行任何内容），而许多现成的 "loader" SVG 使用
     * `<animate>` 播放动画。logo 不需要这些，因此仍然不允许。
     */
    private const ANIMATION_ELEMENTS = ['animate', 'animatetransform', 'animatemotion', 'set', 'mpath'];

    /** 不指向文件自身 `#id` 的 `url(`。 */
    private const EXTERNAL_URL = '/url\(\s*["\x27]?\s*(?!#)/i';

    public static function sanitize(string $svg, bool $allowAnimation = false): ?string
    {
        // 空字节 = UTF-16/UTF-32：下面的 `<!ENTITY` 在这种编码里搜不到，
        // 而 libxml 仍会读取 DTD。
        if (trim($svg) === '' || str_contains($svg, "\0") || stripos($svg, '<!ENTITY') !== false || stripos($svg, '<!DOCTYPE') !== false) {
            return null;
        }

        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($svg, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->documentElement;

        if (! $loaded || ! $root || strtolower($root->localName) !== 'svg') {
            return null;
        }

        // 第二道关卡，已是读好的文档：不接受 DTD，也只接受 UTF-8。
        $encoding = strtolower((string) $document->xmlEncoding);

        if ($document->doctype !== null || ($encoding !== '' && $encoding !== 'utf-8')) {
            return null;
        }

        self::clean($root, $allowAnimation);

        return $document->saveXML($root) ?: null;
    }

    private static function clean(DOMElement $element, bool $allowAnimation = false): void
    {
        foreach (iterator_to_array($element->childNodes) as $child) {
            if ($child instanceof DOMElement) {
                $name = strtolower($child->localName);
                $allowed = in_array($name, self::ELEMENTS, true)
                    || ($allowAnimation && in_array($name, self::ANIMATION_ELEMENTS, true) && self::safeAnimation($child));

                if (! $allowed) {
                    $element->removeChild($child);
                    continue;
                }

                self::clean($child, $allowAnimation);
            } elseif ($child->nodeType === XML_PI_NODE || $child->nodeType === XML_COMMENT_NODE) {
                $element->removeChild($child);
            }
        }

        foreach (iterator_to_array($element->attributes) as $attribute) {
            $name = strtolower($attribute->nodeName);
            $value = trim($attribute->nodeValue ?? '');

            $unsafe = str_starts_with($name, 'on')
                || (str_ends_with($name, 'href') && ! self::safeHref($value))
                || stripos($value, 'javascript:') !== false
                || preg_match(self::EXTERNAL_URL, $value) === 1
                || ($name === 'style' && self::cssEscaped($value));

            if ($unsafe) {
                $element->removeAttributeNode($attribute);
            }
        }

        // <style>：不含 @import，也不含指向外部的 url()。
        if (strtolower($element->localName) === 'style') {
            $css = $element->textContent;

            if (stripos($css, '@import') !== false || stripos($css, 'javascript:') !== false || stripos($css, 'expression(') !== false || preg_match(self::EXTERNAL_URL, $css) === 1 || self::cssEscaped($css)) {
                $element->textContent = '';
            }
        }
    }

    /**
     * CSS 转义（`\75 rl(`、`@\69mport`）：浏览器会还原转义并读取
     * `url(`/`@import`，而上面的文本检查识别不到。logo 不需要这种写法，
     * 因此含反斜杠的 CSS 不会通过。
     */
    private static function cssEscaped(string $css): bool
    {
        return str_contains($css, '\\');
    }

    /**
     * 修改 `href` 或事件（`on*`）的 `<animate>`/`<set>` 会在清理之后
     * 更换链接目标或创建处理函数：整个移除。
     */
    private static function safeAnimation(DOMElement $element): bool
    {
        $target = strtolower(trim($element->getAttribute('attributeName')));

        return ! str_contains($target, 'href') && ! str_starts_with($target, 'on');
    }

    private static function safeHref(string $value): bool
    {
        return str_starts_with($value, '#') || preg_match('#^data:image/(png|jpe?g|gif|webp);base64,#i', $value) === 1;
    }
}
