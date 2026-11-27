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
 * 主题不再使用 "canela" 前缀（来自 fork 的遗留）：一切都改为
 * "lcoy"。这里是数据库需要随之完成的改名 ——
 * 表、配置键和通知类型 —— 并保留
 * 已有数据。
 *
 * 全新安装没有任何旧前缀的内容：每一步只在
 * 找到旧名称时才执行。
 */
$tables = [
    'bookmarks',
    'user_visits',
];

return [
    'up' => static function (Builder $schema) use ($tables): void {
        foreach ($tables as $table) {
            if ($schema->hasTable('canela_'.$table) && ! $schema->hasTable('lcoy_'.$table)) {
                $schema->rename('canela_'.$table, 'lcoy_'.$table);
            }
        }

        $db = $schema->getConnection();

        // 配置：通过仓库写入，以便缓存（fof/redis）一并
        // 更新；若不可用，则退回到直接 UPDATE。
        $rows = $db->table('settings')->where('key', 'like', 'canela.%')->get();

        if ($rows->isNotEmpty()) {
            try {
                $settings = resolve(SettingsRepositoryInterface::class);

                foreach ($rows as $row) {
                    $new = 'lcoy.'.substr((string) $row->key, strlen('canela.'));
                    $settings->set($new, $row->value);
                    $settings->delete((string) $row->key);
                }
            } catch (\Throwable) {
                foreach ($rows as $row) {
                    $new = 'lcoy.'.substr((string) $row->key, strlen('canela.'));

                    if ($db->table('settings')->where('key', $new)->exists()) {
                        $db->table('settings')->where('key', $row->key)->delete();
                    } else {
                        $db->table('settings')->where('key', $row->key)->update(['key' => $new]);
                    }
                }

                // 设置缓存可能还留着旧键：能忘就忘，忘不了也不影响新键读取。
                try {
                    resolve(\Illuminate\Contracts\Cache\Repository::class)->forget('flarum:settings');
                } catch (\Throwable) {
                }
            }
        }

        // 旧通知（帖子已编辑 / 讨论已关联）继续
        // 以新类型正常打开。
        foreach ($db->table('notifications')->where('type', 'like', 'canela%')->get(['id', 'type']) as $row) {
            $db->table('notifications')->where('id', $row->id)->update([
                'type' => 'lcoy'.substr((string) $row->type, strlen('canela')),
            ]);
        }

        // 权限，以防旧版本还留下了某些旧记录。
        foreach ($db->table('group_permission')->where('permission', 'like', 'canela.%')->get(['group_id', 'permission']) as $row) {
            $db->table('group_permission')
                ->where('group_id', $row->group_id)
                ->where('permission', $row->permission)
                ->update(['permission' => 'lcoy.'.substr((string) $row->permission, strlen('canela.'))]);
        }

        // 邀请功能已移除：权限记录无论新旧前缀都不再保留。
        $db->table('group_permission')
            ->whereIn('permission', ['lcoy.createInvite', 'canela.createInvite'])
            ->delete();
    },

    'down' => static function (Builder $schema) use ($tables): void {
        foreach ($tables as $table) {
            if ($schema->hasTable('lcoy_'.$table) && ! $schema->hasTable('canela_'.$table)) {
                $schema->rename('lcoy_'.$table, 'canela_'.$table);
            }
        }

        $db = $schema->getConnection();

        foreach ($db->table('settings')->where('key', 'like', 'lcoy.%')->get() as $row) {
            $db->table('settings')->where('key', $row->key)->update([
                'key' => 'canela.'.substr((string) $row->key, strlen('lcoy.')),
            ]);
        }

        $db->table('notifications')
            ->where('type', 'like', 'lcoy%')
            ->update(['type' => $db->raw("REPLACE(type, 'lcoy', 'canela')")]);
    },
];
