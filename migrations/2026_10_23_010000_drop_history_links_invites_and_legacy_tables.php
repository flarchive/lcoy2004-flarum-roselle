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
 * 移除已从主题中去掉的功能：编辑历史、链接点击和邀请链接。
 * 数据表连同其中的数据一起删除，只保留仍在代码中
 * 使用的功能（书签、访问记录等）。
 *
 * 顺便清理旧版本遗留的四个空表
 * （me_too、topic_views、topic_view_stats、user_badges）—— 如今已没有
 * 代码读取它们。
 */
$tables = [
    // 先删邀请：兑换记录有指向邀请的外键。
    'lcoy_invite_redemptions',
    'lcoy_invites',
    'lcoy_post_revisions',
    'lcoy_link_clicks',
    // 旧名称（fork 时期的前缀），用于仍然存在这些名称的安装。
    'canela_invite_redemptions',
    'canela_invites',
    'canela_post_revisions',
    'canela_link_clicks',
    // 遗留项，代码中已无引用。
    'lcoy_me_too',
    'lcoy_topic_views',
    'lcoy_topic_view_stats',
    'lcoy_user_badges',
    'canela_me_too',
    'canela_topic_views',
    'canela_topic_view_stats',
    'canela_user_badges',
];

$settings = [
    'lcoy.post_history_enabled',
    'lcoy.stats_links_enabled',
    'lcoy.stats_visitor_salt',
    'lcoy.invites_enabled',
    'lcoy.invites_expire_days',
    'canela.post_history_enabled',
    'canela.stats_links_enabled',
    'canela.stats_visitor_salt',
    'canela.invites_enabled',
    'canela.invites_expire_days',
];

return [
    'up' => static function (Builder $schema) use ($tables, $settings): void {
        foreach ($tables as $table) {
            if ($schema->hasTable($table)) {
                $schema->drop($table);
            }
        }

        // 已移除功能的配置、权限和历史通知。
        $db = $schema->getConnection();

        $db->table('settings')->whereIn('key', $settings)->delete();
        $db->table('group_permission')->where('permission', 'lcoy.createInvite')->delete();
        $db->table('notifications')->where('type', 'lcoyInviteAccepted')->delete();
    },

    'down' => static function (Builder $schema): void {
        // 无法回滚：数据表和数据是被有意删除的。
    },
];
