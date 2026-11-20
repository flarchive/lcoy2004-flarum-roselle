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
 * 主题不再保存自己的资料字段：头衔、状态和生日
 * 已从代码中移除（简介/所在地/网站由 fof/user-bio 和
 * fof/socialprofile 提供，封面由 forumaker/profile-cover 提供）。
 * 旧迁移在 `users` 中创建的列一并删除 —— 包括生日数据，
 * 按需求处理。
 */
$columns = [
    'lcoy_title',
    'lcoy_status_emoji',
    'lcoy_status_text',
    'lcoy_status_until',
    'lcoy_birthday',
];

return [
    'up' => static function (Builder $schema) use ($columns): void {
        // 全新安装从来没有这些列：只删除存在的列。
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

    'down' => static function (Builder $schema): void {
        // 回滚不带数据：列会以空值恢复，与旧结构一致。
        $missing = static fn (string $column): bool => ! $schema->hasColumn('users', $column);

        $schema->table('users', static function (Blueprint $table) use ($missing): void {
            $missing('lcoy_title') && $table->string('lcoy_title', 60)->nullable();
            $missing('lcoy_status_emoji') && $table->string('lcoy_status_emoji', 32)->nullable();
            $missing('lcoy_status_text') && $table->string('lcoy_status_text', 100)->nullable();
            $missing('lcoy_status_until') && $table->dateTime('lcoy_status_until')->nullable();
            $missing('lcoy_birthday') && $table->date('lcoy_birthday')->nullable();
        });
    },
];
