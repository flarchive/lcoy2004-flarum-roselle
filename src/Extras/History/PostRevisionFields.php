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

namespace Lcoy\Roselle\Extras\History;

use Flarum\Api\Schema;
use Flarum\Post\CommentPost;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Lcoy\Roselle\Extras\Extras;

/**
 * `canelaRevisionCount` na postagem: quantas edições o histórico guardou, o
 * número ao lado do lápis no cabeçalho do post.
 *
 * Conta pela relação (um COUNT agrupado para a página inteira de postagens, e
 * não uma consulta por post). Com o recurso desligado o atributo some, e o
 * fórum volta ao "Editado" do core.
 */
final class PostRevisionFields
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    /**
     * @return array<Schema\Integer>
     */
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('canelaRevisionCount')
                ->countRelation('canelaRevisions')
                ->visible(fn (Post $post): bool => $post instanceof CommentPost
                    && Extras::enabled($this->settings, Extras::POST_HISTORY)),
        ];
    }
}
