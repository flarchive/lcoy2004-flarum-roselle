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
use Illuminate\Database\Eloquent\Builder;

/**
 * 单个过滤器无法完成的主题搜索调整。
 *
 * - `in:title`（`filter[lcoyInTitle]`）：自由文本只在标题中生效。过滤器
 *   拿不到文本（文本位于 `filter[q]`），但 mutator 能拿到完整的检索条件。
 *   核心的文本搜索仍会执行——它允许主题因标题或帖子而命中——而这里要求
 *   每个词都出现在标题中，从而只留下标题命中的结果。
 * - "最多点赞"（`sort=-lcoyLikes`）：统计首帖的点赞数，与 Discourse 对
 *   主题采用的标准相同。见 SortsByLikes。
 */
final class DiscussionSearchMutator
{
    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        $query = $state->getQuery();

        $this->restrictToTitle($query, $criteria);

        if (SortsByLikes::requested($criteria)) {
            SortsByLikes::addColumn($query, 'discussions.first_post_id');
        }
    }

    private function restrictToTitle(Builder $query, SearchCriteria $criteria): void
    {
        $filters = $criteria->filters;

        if (! array_key_exists('lcoyInTitle', $filters) || ! is_string($filters['q'] ?? null)) {
            return;
        }

        $words = preg_split('/\s+/u', trim($filters['q'])) ?: [];

        foreach ($words as $word) {
            if ($word === '') {
                continue;
            }

            // LIKE 的通配符已被转义："50%" 会按字面查找 "50%"。
            $escaped = addcslashes($word, '\\%_');

            $query->where('discussions.title', 'like', "%{$escaped}%");
        }
    }
}
