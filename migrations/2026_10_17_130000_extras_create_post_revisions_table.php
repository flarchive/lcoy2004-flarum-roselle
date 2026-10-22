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
 * Histórico de edições: uma linha por edição, com o texto que existia ANTES
 * dela (o atual mora na própria postagem).
 *
 * - `post_id` apaga em cascata: postagem excluída leva o histórico junto, e
 *   nada fica órfão guardando texto de algo que não existe mais.
 * - `user_id` fica nulo quando o editor é excluído, para a versão continuar
 *   no histórico (só sem o nome de quem editou).
 * - `content` é `mediumText`, a mesma coluna das postagens do core.
 */
return [
    'up' => static function (Builder $schema): void {
        // Idempotente: quem vem do Canela já tem a tabela, mas a migração
        // antiga não está registrada com este nome.
        if ($schema->hasTable('canela_post_revisions')) {
            return;
        }

        $schema->create('canela_post_revisions', static function (Blueprint $table): void {
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
        $schema->dropIfExists('canela_post_revisions');
    },
];
