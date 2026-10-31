<?php

/*
 * This file is part of lcoy/roselle.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 * Copyright (c) 2026 lcoy
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Builder;

/*
 * 将论坛颜色切换到 Horizon 调色板（Discourse 的默认主题）：
 * 主色变为紫色 #595bca，主题由它派生背景色、选中态和链接色。
 * 只替换仍为默认值的项 —— 无论来自核心还是 Lcoy 的第一版（当时用绿色和
 * 青柠色）。管理员已选定的颜色保持原样。
 */
return [
    'up' => static function (Builder $schema): void {
        $connection = $schema->getConnection();

        // 每次调用都新建一个查询：查询构造器会累积 where 条件，
        // 复用它会让第二个颜色同时查找两个键。
        $replace = static function (string $key, array $defaults, string $color) use ($connection): void {
            $current = $connection->table('settings')->where('key', $key)->value('value');

            if ($current === null) {
                $connection->table('settings')->insert(['key' => $key, 'value' => $color]);

                return;
            }

            if (in_array(strtolower((string) $current), $defaults, true)) {
                $connection->table('settings')->where('key', $key)->update(['value' => $color]);
            }
        };

        $replace('theme_primary_color', ['#4d698e', '#1fbf0f'], '#595bca');
        $replace('theme_secondary_color', ['#4d698e', '#c3df00'], '#3b3e56');
    },

    // 卸载主题不会还原颜色：此时管理员可能已经
    // 基于这些颜色调整过调色板。
    'down' => static function (Builder $schema): void {
    },
];
