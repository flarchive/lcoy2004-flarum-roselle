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
 * 谁通过哪个邀请加入 —— 即 Discourse 的 "邀请人"。一个用户
 * 只能通过一个邀请加入（主键就是用户）。
 */
return [
    'up' => static function (Builder $schema): void {
        // 幂等：来自 Lcoy 的用户已经有该表，但旧的迁移
        // 没有以这个名称注册。
        if ($schema->hasTable('lcoy_invite_redemptions')) {
            return;
        }

        $schema->create('lcoy_invite_redemptions', static function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->unsignedInteger('invite_id');
            $table->dateTime('created_at')->nullable();

            $table->index('invite_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('invite_id')->references('id')->on('lcoy_invites')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('lcoy_invite_redemptions');
    },
];
