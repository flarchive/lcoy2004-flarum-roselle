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
 * Um dia de visita por linha, como o `user_visits` do Discourse: daqui saem os
 * "Dias visitados", o "Tempo de leitura" e as "Postagens lidas" do resumo do
 * perfil. Por dia (e não por acesso) para a tabela crescer no máximo uma
 * linha por pessoa por dia, e para a soma do perfil ser um SUM simples.
 */
return [
    'up' => static function (Builder $schema): void {
        // Idempotente: quem vem do Canela já tem a tabela, mas a migração
        // antiga não está registrada com este nome.
        if ($schema->hasTable('canela_user_visits')) {
            return;
        }

        $schema->create('canela_user_visits', static function (Blueprint $table): void {
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
        $schema->dropIfExists('canela_user_visits');
    },
];
