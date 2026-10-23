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

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * 扩展资料字段直接放在 `users` 表中：每个用户各一份，
 * 总是与他一起读取 —— 单独建表会让每个序列化的帖子多做一次 join，
 * 只为显示状态 emoji。
 *
 * 简介、所在地和网站交给 fof/user-bio 和 fof/socialprofile。
 */
$columns = [
    'lcoy_title',
    'lcoy_status_emoji',
    'lcoy_status_text',
    'lcoy_status_until',
    'lcoy_birthday',
];

return [
    'up' => static function (Builder $schema): void {
        // 幂等：中途中断的迁移可以再次运行。
        $missing = static fn (string $column): bool => ! $schema->hasColumn('users', $column);

        $schema->table('users', static function (Blueprint $table) use ($missing): void {
            $missing('lcoy_title') && $table->string('lcoy_title', 60)->nullable();
            // emoji 最多有 16 个码点（家庭、地区旗帜），
            // 因此留出余量。
            $missing('lcoy_status_emoji') && $table->string('lcoy_status_emoji', 32)->nullable();
            $missing('lcoy_status_text') && $table->string('lcoy_status_text', 100)->nullable();
            $missing('lcoy_status_until') && $table->dateTime('lcoy_status_until')->nullable();
            $missing('lcoy_birthday') && $table->date('lcoy_birthday')->nullable();
        });
    },

    'down' => static function (Builder $schema) use ($columns): void {
        $existing = array_values(array_filter(
            $columns,
            static fn (string $column): bool => $schema->hasColumn('users', $column)
        ));

        if ($existing !== []) {
            $schema->table('users', static function (Blueprint $table) use ($existing): void {
                $table->dropColumn($existing);
            });
        }
    },
];
