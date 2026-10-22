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
 * Campos do perfil estendido direto na tabela `users`: são um por usuário,
 * lidos sempre junto com ele — uma tabela à parte custaria um join em cada
 * post serializado só para mostrar o emoji do status.
 *
 * Bio, local e site ficam com o fof/user-bio e o fof/socialprofile.
 */
$columns = [
    'canela_title',
    'canela_status_emoji',
    'canela_status_text',
    'canela_status_until',
    'canela_birthday',
];

return [
    'up' => static function (Builder $schema): void {
        // Idempotente: uma migração interrompida no meio pode rodar de novo.
        $missing = static fn (string $column): bool => ! $schema->hasColumn('users', $column);

        $schema->table('users', static function (Blueprint $table) use ($missing): void {
            $missing('canela_title') && $table->string('canela_title', 60)->nullable();
            // O emoji tem até 16 pontos de código (famílias, bandeiras de
            // regiões), daí a folga.
            $missing('canela_status_emoji') && $table->string('canela_status_emoji', 32)->nullable();
            $missing('canela_status_text') && $table->string('canela_status_text', 100)->nullable();
            $missing('canela_status_until') && $table->dateTime('canela_status_until')->nullable();
            $missing('canela_birthday') && $table->date('canela_birthday')->nullable();
        });
    },

    'down' => static function (Builder $schema) use ($columns): void {
        $existing = array_values(array_filter(
            $columns,
            static fn (string $column): bool => $schema->hasColumn('users', $column)
        ));

        if ($existing !== []) {
            $schema->table('users', static function (Blueprint $table) use ($existing): void {
                $table->dropColumn($existing);
            });
        }
    },
];
