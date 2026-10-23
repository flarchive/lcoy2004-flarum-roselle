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
 * 编辑历史：每次编辑一行，保存编辑之前存在的内容
 * （当前内容保存在帖子自身中）。
 *
 * - `post_id` 级联删除：帖子被删除时历史一并删除，
 *   不会留下保存着已不存在内容的孤立记录。
 * - 编辑者被删除时 `user_id` 置空，让该版本仍留在
 *   历史中（只是没有编辑者的名字）。
 * - `content` 是 `mediumText`，与核心帖子的列相同。
 */
return [
    'up' => static function (Builder $schema): void {
        // 幂等：来自 Lcoy 的用户已经有该表，但旧的迁移
        // 没有以这个名称注册。
        if ($schema->hasTable('lcoy_post_revisions')) {
            return;
        }

        $schema->create('lcoy_post_revisions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('post_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('revision');
            $table->mediumText('content');
            $table->dateTime('created_at');

            $table->unique(['post_id', 'revision']);
            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('lcoy_post_revisions');
    },
];
