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
 * 把重命名表时留下的旧前缀索引/外键名一并换掉。
 *
 * `RENAME TABLE` 只改表名，索引和外键约束仍叫 `flarum_canela_bookmarks_*`。
 * 这里先删旧外键、改索引名，再按新名字加回外键；最后删掉旧 Canela 会话扩展
 * 留在 `dialog_user` 上的一个冗余索引（`user_id` 已有外键索引）。
 *
 * 只在 MySQL/MariaDB 上执行（SQLite 等没有这些名字）。
 */
$indexes = [
    'lcoy_bookmarks' => [
        'canela_bookmarks_post_id_foreign' => 'lcoy_bookmarks_post_id_foreign',
        'canela_bookmarks_user_id_post_id_unique' => 'lcoy_bookmarks_user_id_post_id_unique',
        'canela_bookmarks_reminded_at_reminder_at_index' => 'lcoy_bookmarks_reminded_at_reminder_at_index',
    ],
    'lcoy_user_visits' => [
        'canela_user_visits_user_id_visited_at_unique' => 'lcoy_user_visits_user_id_visited_at_unique',
    ],
];

$foreignKeys = [
    // [表, 旧外键名, 新外键名, 列, 引用表]
    ['lcoy_bookmarks', 'canela_bookmarks_post_id_foreign', 'lcoy_bookmarks_post_id_foreign', 'post_id', 'posts'],
    ['lcoy_bookmarks', 'canela_bookmarks_user_id_foreign', 'lcoy_bookmarks_user_id_foreign', 'user_id', 'users'],
    ['lcoy_user_visits', 'canela_user_visits_user_id_foreign', 'lcoy_user_visits_user_id_foreign', 'user_id', 'users'],
];

return [
    'up' => static function (Builder $schema) use ($indexes, $foreignKeys): void {
        $db = $schema->getConnection();

        if ($db->getDriverName() !== 'mysql') {
            return;
        }

        $prefix = $db->getTablePrefix();

        $indexExists = static function (string $table, string $index) use ($db): bool {
            return (bool) $db->selectOne(
                'SELECT 1 AS ok FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
                [$table, $index]
            );
        };

        $fkExists = static function (string $table, string $name) use ($db): bool {
            return (bool) $db->selectOne(
                'SELECT 1 AS ok FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = \'FOREIGN KEY\' LIMIT 1',
                [$table, $name]
            );
        };

        // 1. 删旧外键（索引会留下，下一步改名）。
        foreach ($foreignKeys as [$table, $old]) {
            $fullTable = $prefix.$table;
            $fullOld = $prefix.$old;

            if ($fkExists($fullTable, $fullOld)) {
                $db->statement("ALTER TABLE `{$fullTable}` DROP FOREIGN KEY `{$fullOld}`");
            }
        }

        // 2. 改索引名（唯一索引同时也是唯一约束）。
        foreach ($indexes as $table => $map) {
            $fullTable = $prefix.$table;

            foreach ($map as $old => $new) {
                $fullOld = $prefix.$old;
                $fullNew = $prefix.$new;

                if ($indexExists($fullTable, $fullOld) && ! $indexExists($fullTable, $fullNew)) {
                    $db->statement("ALTER TABLE `{$fullTable}` RENAME INDEX `{$fullOld}` TO `{$fullNew}`");
                }
            }
        }

        // 3. 按新名字加回外键。
        foreach ($foreignKeys as [$table, $old, $new, $column, $references]) {
            $fullTable = $prefix.$table;
            $fullNew = $prefix.$new;
            $fullReferences = $prefix.$references;

            if (! $fkExists($fullTable, $fullNew)) {
                $db->statement(
                    "ALTER TABLE `{$fullTable}` ADD CONSTRAINT `{$fullNew}` FOREIGN KEY (`{$column}`) REFERENCES `{$fullReferences}` (`id`) ON DELETE CASCADE"
                );
            }
        }

        // 4. 旧 Canela 会话扩展留下的冗余索引：`user_id` 已有外键索引。
        $dialogUser = $prefix.'dialog_user';

        if ($indexExists($dialogUser, 'dialog_user_canela_archived_index')) {
            $db->statement("ALTER TABLE `{$dialogUser}` DROP INDEX `dialog_user_canela_archived_index`");
        }
    },

    'down' => static function (Builder $schema): void {
        // 只是改名字，不恢复旧前缀。
    },
];
