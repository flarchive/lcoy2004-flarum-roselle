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
 * 清理 Canela 生态遗留的孤儿表。
 *
 * 这些表由当年配套的 Canela 扩展（AI、聊天、徽章、草稿、会话）创建，扩展
 * 早已停用/移除，但 MySQL 表一直留着。现在没有任何已安装扩展或本主题代码
 * 引用它们（`vendor/` 内 0 处引用），全部为空，只有 `canela_badges` 有 34
 * 条旧徽章定义——按确认，全部删除（含数据）。
 *
 * 每张表都先判断存在再删：新安装本来就没有它们。删除时临时关闭外键检查，
 * 避免这些遗留表之间互相引用的外键挡住 DROP。
 */
$tables = [
    // AI
    'canela_ai_conversations',
    'canela_ai_embeddings',
    'canela_ai_messages',
    'canela_ai_post_locales',
    'canela_ai_post_translations',
    'canela_ai_summaries',
    'canela_ai_title_translations',
    'canela_ai_translation_usage',
    'canela_ai_usage',
    // 聊天
    'canela_chat_channels',
    'canela_chat_memberships',
    'canela_chat_mentions',
    'canela_chat_messages',
    'canela_chat_pins',
    'canela_chat_reactions',
    'canela_chat_thread_memberships',
    'canela_chat_threads',
    'canela_chat_uploads',
    // 会话
    'canela_dialog_events',
    'canela_dialog_message_reactions',
    // 徽章与草稿
    'canela_badges',
    'canela_drafts',
];

return [
    'up' => static function (Builder $schema) use ($tables): void {
        $db = $schema->getConnection();
        // 仅 MySQL/MariaDB 需要临时关外键；别的驱动（SQLite 等）直接删。
        $mysql = $db->getDriverName() === 'mysql';

        if ($mysql) {
            $db->statement('SET FOREIGN_KEY_CHECKS=0');
        }

        try {
            foreach ($tables as $table) {
                if (! $schema->hasTable($table)) {
                    continue;
                }

                $schema->drop($table);
            }
        } finally {
            if ($mysql) {
                $db->statement('SET FOREIGN_KEY_CHECKS=1');
            }
        }
    },

    'down' => static function (Builder $schema): void {
        // 不可逆：这些表属于已移除的扩展，结构不再保留。
    },
];
