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
 * 每次访问一天一行，与 Discourse 的 `user_visits` 相同：个人资料摘要中的
 * "访问天数"、"阅读时长" 和 "已读帖子" 由此得出。
 * 按天（而不是按访问）记录，使表最多每人每天增长一行，
 * 并让个人资料的汇总成为简单的 SUM。
 */
return [
    'up' => static function (Builder $schema): void {
        // 幂等：来自 Lcoy 的用户已经有该表，但旧的迁移
        // 没有以这个名称注册。
        if ($schema->hasTable('lcoy_user_visits')) {
            return;
        }

        $schema->create('lcoy_user_visits', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->date('visited_at');
            $table->unsignedInteger('posts_read')->default(0);
            $table->unsignedInteger('time_read')->default(0);
            $table->boolean('mobile')->default(false);

            $table->unique(['user_id', 'visited_at']);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('lcoy_user_visits');
    },
];
