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

namespace Lcoy\Roselle\Gaps\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Lcoy\Roselle\Gaps\Invites\InviteService;

/**
 * O que o fórum precisa saber do backend dos recursos (gaps) para quem está
 * vendo: se pode gerar convites.
 */
final class ForumResourceFields
{
    public function __construct(
        private readonly InviteService $invites,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canelaCanInvite')
                ->get(fn (object $forum, Context $context) => $this->invites->canCreate($context->getActor())),
        ];
    }
}
