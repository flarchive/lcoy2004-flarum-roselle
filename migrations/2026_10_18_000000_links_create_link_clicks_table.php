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
 * 帖子链接的每次点击一行，与 Discourse 的 `topic_link_clicks` 相同：
 * 帖子中链接旁的数字、"主题地图" 的 "热门链接" 以及
 * 个人资料摘要中的 "最佳链接" 都由此得出。
 *
 * 地址完整保存在 `url` 中（用于展示），并以 sha1 保存在 `url_hash` 中
 * （用于分组和建索引：最长 2 000 字符的文本索引会
 * 超出 MariaDB 的键长度限制）。访客的 `user_id` 为空；
 * 删除账号的人会留下这些点击，因为它们属于链接，而不是他。
 */
return [
    'up' => static function (Builder $schema): void {
        // 幂等：来自 Lcoy 的用户已经有该表，但旧的迁移
        // 没有以这个名称注册。
        if ($schema->hasTable('lcoy_link_clicks')) {
            return;
        }

        $schema->create('lcoy_link_clicks', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('discussion_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->char('url_hash', 40);
            $table->string('url', 2000);
            $table->dateTime('created_at');

            $table->index(['discussion_id', 'url_hash']);
            $table->index(['post_id', 'url_hash']);
            $table->index('created_at');

            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('lcoy_link_clicks');
    },
];
