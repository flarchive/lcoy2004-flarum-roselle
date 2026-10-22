<?php

declare(strict_types=1);

/*
 * This file is part of lcoy/roselle.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 * Copyright (c) 2026 lcoy
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Lcoy\Roselle\Links\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Lcoy\Roselle\Links\LinkClicks;

/**
 * `canelaLinks` no tópico: os "Links populares" do mapa e os cliques de cada
 * link em cada postagem. Só na página do tópico (`showing`): na lista seriam
 * consultas por linha para números que ela não mostra. Uma falha vira null —
 * o mapa só não ganha a estatística, o tópico abre normalmente.
 */
final class DiscussionLinksFields
{
    public function __construct(
        private readonly LinkClicks $clicks
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaLinks')
                ->nullable()
                ->visible(fn (Discussion $discussion, Context $context): bool => $this->clicks->enabled() && $context->showing(DiscussionResource::class))
                ->get(function (Discussion $discussion): ?array {
                    try {
                        return $this->clicks->forDiscussion($discussion);
                    } catch (\Throwable $error) {
                        error_log('[lcoy/roselle] links do tópico: '.$error->getMessage());

                        return null;
                    }
                }),
        ];
    }
}
