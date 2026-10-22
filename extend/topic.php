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

/*
 * Página do tópico: o "Marcar não lido" do rodapé (Discourse). O fórum
 * anuncia `canelaMarkUnread` para o JS só mostrar o botão quando este
 * arquivo está carregado.
 */

use Flarum\Api\Context;
use Flarum\Api\Endpoint\Index;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Lcoy\Roselle\Topic\Api\DiscussionMarkUnreadField;
use Lcoy\Roselle\Topic\Api\DiscussionParticipantsField;

return [
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionMarkUnreadField::class)
        ->fields(DiscussionParticipantsField::class)
        // A lista mostra até quatro avatares de participantes em cada linha.
        // O atributo é enxuto (não inclui os usuários como recursos) e a página
        // inteira sai em duas consultas, graças ao prefetch abaixo.
        ->endpoint(Index::class, fn (Index $endpoint) => $endpoint
            ->beforeSerialization(static function (Context $context, array $results): void {
                resolve(DiscussionParticipantsField::class)->prefetch($results['models'] ?? []);
            })),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canelaMarkUnread')->get(fn () => true),
        ]),
];
