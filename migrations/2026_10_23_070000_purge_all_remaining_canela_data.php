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

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\Schema\Builder;

/*
 * 兜底清理：把数据库里**所有**还带 canela 前缀的东西一次删干净。
 *
 * 前面的迁移按名单删表和改前缀；这里不再依赖名单，直接查 information_schema：
 * 任何 `canela_*` 表、任何表上的 `canela_*` 列、`canela.*` 设置键、权限、
 * 通知类型，以及用户偏好 JSON 里以 canela 开头的键，全部删除。
 *
 * 目标站点如果还装着 Canela 配套扩展，这些表和列也会被删掉——按需求，升级
 * 即清理，不再保留。删除不可逆。
 */
return [
    'up' => static function (Builder $schema): void {
        $db = $schema->getConnection();
        $prefix = $db->getTablePrefix();
        $driver = $db->getDriverName();

        if ($driver === 'mysql') {
            // 1. 所有 canela_* 表（关外键检查，避免互相引用挡住 DROP）。
            $db->statement('SET FOREIGN_KEY_CHECKS=0');

            try {
                $tables = $db->select(
                    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE ?',
                    [$prefix.'canela\_%']
                );

                foreach ($tables as $table) {
                    $db->statement("DROP TABLE IF EXISTS `{$table->name}`");
                }
            } finally {
                $db->statement('SET FOREIGN_KEY_CHECKS=1');
            }

            // 2. 所有表上的 canela_* 列：先删相关外键，再删列。
            $columns = $db->select(
                'SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE ?',
                ['canela\_%']
            );

            foreach ($columns as $column) {
                $outgoing = $db->select(
                    'SELECT CONSTRAINT_NAME AS n FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
                    [$column->t, $column->c]
                );

                foreach ($outgoing as $fk) {
                    try {
                        $db->statement("ALTER TABLE `{$column->t}` DROP FOREIGN KEY `{$fk->n}`");
                    } catch (\Throwable) {
                        // 已经不存在或名字不同：继续。
                    }
                }

                $incoming = $db->select(
                    'SELECT TABLE_NAME AS t, CONSTRAINT_NAME AS n FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?',
                    [$column->t, $column->c]
                );

                foreach ($incoming as $fk) {
                    try {
                        $db->statement("ALTER TABLE `{$fk->t}` DROP FOREIGN KEY `{$fk->n}`");
                    } catch (\Throwable) {
                        // 同上。
                    }
                }

                try {
                    $db->statement("ALTER TABLE `{$column->t}` DROP COLUMN `{$column->c}`");
                } catch (\Throwable) {
                    // 仍被约束引用时跳过，下一次升级还能再试。
                }
            }
        }

        // 3. 设置、权限、通知类型。
        $keys = $db->table('settings')->where('key', 'like', 'canela.%')->pluck('key');

        if ($keys->isNotEmpty()) {
            try {
                $settings = resolve(SettingsRepositoryInterface::class);

                foreach ($keys as $key) {
                    $settings->delete((string) $key);
                }
            } catch (\Throwable) {
                $db->table('settings')->where('key', 'like', 'canela.%')->delete();
            }
        }

        $db->table('group_permission')->where('permission', 'like', 'canela%')->delete();
        $db->table('notifications')->where('type', 'like', 'canela%')->delete();

        // 4. 用户偏好 JSON 里以 canela 开头的键。
        foreach ($db->table('users')->whereNotNull('preferences')->where('preferences', 'like', '%canela%')->get(['id', 'preferences']) as $user) {
            $preferences = json_decode((string) $user->preferences, true);

            if (! is_array($preferences)) {
                continue;
            }

            $changed = false;

            foreach (array_keys($preferences) as $key) {
                if (str_starts_with((string) $key, 'canela')) {
                    unset($preferences[$key]);
                    $changed = true;
                }
            }

            if ($changed) {
                $db->table('users')->where('id', $user->id)->update([
                    'preferences' => json_encode($preferences, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
            }
        }
    },

    'down' => static function (Builder $schema): void {
        // 不可逆：清理的就是不再保留的旧功能和旧数据。
    },
];
