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
 * Discourse 的邀请链接：邀请者生成一个带有效期和最大使用次数的链接；
 * 每一次通过它完成的注册都计为一次使用。
 *
 * 链接中携带的是 code（唯一、不可预测）。删除邀请者会删除
 * 他的邀请：孤立链接没有可通知的对象。
 */
return [
    'up' => static function (Builder $schema): void {
        // 幂等：来自 Lcoy 的用户已经有该表，但旧的迁移
        // 没有以这个名称注册。
        if ($schema->hasTable('lcoy_invites')) {
            return;
        }

        $schema->create('lcoy_invites', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('code', 40)->unique();
            $table->unsignedInteger('user_id');
            $table->unsignedSmallInteger('max_redemptions')->default(1);
            $table->unsignedSmallInteger('redemption_count')->default(0);
            $table->dateTime('expires_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('lcoy_invites');
    },
];
