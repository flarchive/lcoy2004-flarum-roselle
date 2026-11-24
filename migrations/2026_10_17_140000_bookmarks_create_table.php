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
 * Discourse 的书签（bookmarks）：每个用户收藏帖子，可带
 * 一个可选名称和一个提醒。
 *
 * - 每个用户和帖子一个书签（唯一索引）：再次收藏会编辑
 *   已有的记录，与 Discourse 相同。
 * - `reminded_at` 与 `reminder_at` 分开：定时命令查找
 *   已到期但尚未发送的提醒，更改时间会重置
 *   发送状态而不丢失上一次的历史。
 * - 外键在帖子或用户被删除时一并删除书签 ——
 *   孤立书签没有可指向的对象。
 */
return [
    'up' => static function (Builder $schema): void {
        // 幂等：来自 Lcoy 的用户已经有该表，但旧的迁移
        // 没有以这个名称注册。
        if ($schema->hasTable('lcoy_bookmarks')) {
            return;
        }

        $schema->create('lcoy_bookmarks', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('post_id');
            $table->string('name', 100)->nullable();
            $table->dateTime('reminder_at')->nullable();
            $table->dateTime('reminded_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            // 定时命令每隔几分钟就会在此索引上扫描。
            $table->index(['reminded_at', 'reminder_at']);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('lcoy_bookmarks');
    },
];
