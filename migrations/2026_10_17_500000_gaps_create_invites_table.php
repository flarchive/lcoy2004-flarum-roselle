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
 * Links de convite do Discourse: quem convida gera um link com validade e um
 * número máximo de usos; cada cadastro feito por ele conta um uso.
 *
 * O código é o que vai no link (único, imprevisível). Apagar quem convidou
 * apaga os convites dele: um link órfão não tem a quem avisar.
 */
return [
    'up' => static function (Builder $schema): void {
        // Idempotente: quem vem do Canela já tem a tabela, mas a migração
        // antiga não está registrada com este nome.
        if ($schema->hasTable('canela_invites')) {
            return;
        }

        $schema->create('canela_invites', static function (Blueprint $table): void {
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
        $schema->dropIfExists('canela_invites');
    },
];
