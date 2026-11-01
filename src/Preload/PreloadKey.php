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

/**
 * 预加载请求的键：API 路径，以及按字母顺序展平、未做 URL 编码的参数
 * （"page[limit]=20"）。
 *
 * JS（`utils/preload.ts`）用即将发送的参数构建相同的键；只有两者匹配时
 * 才使用预加载的数据。任意一方多一个或少一个参数都不会出问题：
 * 页面会自行发出请求。
 */
final class PreloadKey
{
    /** @param array<string, mixed> $query */
    public static function make(string $path, array $query = []): string
    {
        $pairs = [];
        self::flatten($query, '', $pairs);
        sort($pairs, SORT_STRING);

        return trim($path, '/').'?'.implode('&', $pairs);
    }

    /**
     * @param array<array-key, mixed> $value
     * @param list<string> $pairs
     */
    private static function flatten(array $value, string $prefix, array &$pairs): void
    {
        foreach ($value as $key => $item) {
            // 与 JS 一致：Mithril 会省略空值。
            if ($item === null || $item === '') {
                continue;
            }

            $name = $prefix === '' ? (string) $key : $prefix.'['.$key.']';

            if (is_array($item)) {
                self::flatten($item, $name, $pairs);
            } else {
                $pairs[] = $name.'='.(is_bool($item) ? ($item ? 'true' : 'false') : (string) $item);
            }
        }
    }
}
