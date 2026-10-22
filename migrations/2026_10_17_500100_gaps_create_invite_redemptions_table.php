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
 * Quem entrou por qual convite — o "Convidado por" do Discourse. Um usuário
 * entra por um convite só (a chave primária é o usuário).
 */
return [
    'up' => static function (Builder $schema): void {
        // Idempotente: quem vem do Canela já tem a tabela, mas a migração
        // antiga não está registrada com este nome.
        if ($schema->hasTable('canela_invite_redemptions')) {
            return;
        }

        $schema->create('canela_invite_redemptions', static function (Blueprint $table): void {
            $table->unsignedInteger('user_id')->primary();
            $table->unsignedInteger('invite_id');
            $table->dateTime('created_at')->nullable();

            $table->index('invite_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('invite_id')->references('id')->on('canela_invites')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('canela_invite_redemptions');
    },
];
