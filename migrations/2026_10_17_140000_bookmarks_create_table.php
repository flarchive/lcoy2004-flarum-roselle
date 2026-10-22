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
 * Marcadores (bookmarks) do Discourse: cada usuário marca posts, com um nome
 * opcional e um lembrete.
 *
 * - Um marcador por usuário e post (o índice único): marcar de novo edita o
 *   que já existe, como no Discourse.
 * - `reminded_at` separado de `reminder_at`: o comando agendado procura os
 *   lembretes vencidos que ainda não foram enviados, e trocar o horário zera o
 *   envio sem perder o histórico do anterior.
 * - As chaves estrangeiras apagam o marcador junto com o post ou o usuário —
 *   um marcador órfão não tem para onde levar.
 */
return [
    'up' => static function (Builder $schema): void {
        // Idempotente: quem vem do Canela já tem a tabela, mas a migração
        // antiga não está registrada com este nome.
        if ($schema->hasTable('canela_bookmarks')) {
            return;
        }

        $schema->create('canela_bookmarks', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('post_id');
            $table->string('name', 100)->nullable();
            $table->dateTime('reminder_at')->nullable();
            $table->dateTime('reminded_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'post_id']);
            // O comando agendado varre por aqui a cada poucos minutos.
            $table->index(['reminded_at', 'reminder_at']);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('canela_bookmarks');
    },
];
