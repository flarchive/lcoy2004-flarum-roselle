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
 * Cliques em links, como o `topic_link_clicks` do Discourse: o número ao lado
 * de cada link externo nas postagens, os "Links populares" do mapa do tópico
 * e os "Melhores links" do resumo do perfil. O liga/desliga fica no card de
 * estatísticas do admin; desligado, a rota responde 404 e o atributo some.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Extend;
use Lcoy\Roselle\Links\Api\DiscussionLinksFields;
use Lcoy\Roselle\Links\Api\RecordLinkClickController;
use Lcoy\Roselle\Links\LinkClicks;

return [
    (new Extend\Settings())
        ->default(LinkClicks::ENABLED, true)
        ->serializeToForum('canelaLinksEnabled', LinkClicks::ENABLED, 'boolval'),

    (new Extend\Routes('api'))
        ->post('/canela-link-click', 'canela.links.click', RecordLinkClickController::class),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionLinksFields::class),
];
