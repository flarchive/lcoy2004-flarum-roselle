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

namespace Lcoy\Roselle\Extras\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;

/**
 * 帖子搜索中的"最多点赞"（`sort=-lcoyLikes`）：统计帖子自身的点赞数。
 * 见 SortsByLikes。
 */
final class PostSearchMutator
{
    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        if (SortsByLikes::requested($criteria)) {
            SortsByLikes::addColumn($state->getQuery(), 'posts.id');
        }
    }
}
