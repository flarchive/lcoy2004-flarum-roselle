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
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[lcoyMinPosts]=N`：至少有 N 个帖子的主题，即 Discourse 高级
 * 过滤器中的"最少帖子数"。
 *
 * 通过核心已维护的 `comment_count` 列统计：首帖也计入其中，与 Discourse
 * 一致（那里的 `posts_count` 同样包含首帖）。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class MinPostsFilter implements FilterInterface
{
    use ValidateFilterTrait;

    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyMinPosts';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $minimum = max(0, $this->asInt($value));

        // 取反后变为"少于 N"，即该过滤器的精确补集。
        $state->getQuery()->where('discussions.comment_count', $negate ? '<' : '>=', $minimum);
    }
}
