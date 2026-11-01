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
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;

/**
 * 帖子搜索中的 `filter[lcoyBookmarked]`：我标记过的帖子。规则与
 * BookmarkedFilter 相同，只是以帖子为维度。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class PostBookmarkedFilter implements FilterInterface
{
    private readonly BookmarkedFilter $filter;

    public function __construct()
    {
        $this->filter = new BookmarkedFilter('posts');
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return BookmarkedFilter::KEY;
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $this->filter->filter($state, $value, $negate);
    }
}
