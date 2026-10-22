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
 * Estatísticas, como no Discourse: as contagens "Novos (N)" e "Não lidos
 * (N)" e a atividade do resumo do perfil (dias visitados, tempo de leitura,
 * postagens lidas, curtidas).
 *
 * As visualizações de tópico não estão aqui: quem conta e expõe é o
 * fof/discussion-views.
 *
 * Cada parte liga e desliga sozinha no admin. Desligada, o atributo some da
 * API e as rotas próprias respondem 404 — o fórum fica como se ela não
 * existisse, e os números já guardados continuam lá para quando voltar.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Search\Database\DatabaseSearchDriver;
use Lcoy\Roselle\Stats\Api\Controller\RecordReadTimeController;
use Lcoy\Roselle\Stats\Api\Controller\ShowTopicCountsController;
use Lcoy\Roselle\Stats\Api\TopicMapFields;
use Lcoy\Roselle\Stats\Api\ForumResourceFields;
use Lcoy\Roselle\Stats\Api\UserResourceFields;
use Lcoy\Roselle\Stats\Http\RecordVisitMiddleware;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\Search\NewFilter;
use Lcoy\Roselle\Stats\Search\UnreadFilter;

return [
    (new Extend\Settings())
        ->default(StatsSettings::HEAT_LOW, StatsSettings::DEFAULT_HEAT_LOW)
        ->serializeToForum('canelaTopicViewsHeatLow', StatsSettings::HEAT_LOW, 'intval')
        ->default(StatsSettings::HEAT_MEDIUM, StatsSettings::DEFAULT_HEAT_MEDIUM)
        ->serializeToForum('canelaTopicViewsHeatMedium', StatsSettings::HEAT_MEDIUM, 'intval')
        ->default(StatsSettings::HEAT_HIGH, StatsSettings::DEFAULT_HEAT_HIGH)
        ->serializeToForum('canelaTopicViewsHeatHigh', StatsSettings::HEAT_HIGH, 'intval')
        ->default(StatsSettings::COUNTS_ENABLED, true)
        ->serializeToForum('canelaStatsCountsEnabled', StatsSettings::COUNTS_ENABLED, 'boolval')
        ->default(StatsSettings::NEW_DAYS, StatsSettings::DEFAULT_NEW_DAYS)
        ->default(StatsSettings::ACTIVITY_ENABLED, true)
        ->serializeToForum('canelaStatsActivityEnabled', StatsSettings::ACTIVITY_ENABLED, 'boolval'),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(TopicMapFields::class),

    // "Novos (N)" / "Não lidos (N)".
    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumResourceFields::class),

    // Resumo de atividade do perfil.
    (new Extend\ApiResource(UserResource::class))
        ->fields(UserResourceFields::class),

    // As abas "Novos" e "Não lidos" listam pela mesma regra das contagens.
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, NewFilter::class)
        ->addFilter(DiscussionSearcher::class, UnreadFilter::class),

    (new Extend\Routes('api'))
        ->get('/canela-counts', 'canela.stats.counts', ShowTopicCountsController::class)
        ->post('/canela-read-time', 'canela.stats.read_time', RecordReadTimeController::class),

    // O dia de visita conta tanto ao carregar a página quanto ao navegar só
    // pela API (a aba que ficou aberta de um dia para o outro).
    (new Extend\Middleware('forum'))->add(RecordVisitMiddleware::class),
    (new Extend\Middleware('api'))->add(RecordVisitMiddleware::class),
];
