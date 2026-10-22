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

namespace Lcoy\Roselle\Community\Content;

use Closure;
use Flarum\Frontend\Document;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ServerRequestInterface;
use Lcoy\Roselle\Community\Community;

/**
 * O conteúdo das rotas /about, /u e /g no servidor: o título da aba (que o
 * Mithril depois mantém) e o 404 quando o recurso está desligado — sem isso o
 * fórum abriria a página e só então descobriria que ela não existe.
 */
final class CommunityPage
{
    public function __construct(
        private readonly Community $community,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /** O callback de uma página, no formato que o `Extend\Frontend::route()` espera. */
    public static function for(string $settingKey, string $titleKey): Closure
    {
        return static function (Document $document, ServerRequestInterface $request) use ($settingKey, $titleKey): void {
            resolve(self::class)->render($document, $settingKey, $titleKey);
        };
    }

    public function render(Document $document, string $settingKey, string $titleKey): void
    {
        $this->community->assertEnabled($settingKey);

        $document->title = $this->translator->trans("lcoy-roselle.forum.community.$titleKey");
    }
}
