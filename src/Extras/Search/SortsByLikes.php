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

use Flarum\Search\SearchCriteria;
use Illuminate\Database\Eloquent\Builder;

/**
 * 搜索的"最多点赞"排序（`sort=-lcoyLikes`）。
 *
 * 核心的搜索器不使用资源的排序类：它按所请求名称对应的 `snake_case` 列
 * 排序。因此该排序只在资源中注册以通过校验，搜索 mutator 在请求该排序时
 * 把 `lcoy_likes` 列放入 SELECT。
 */
final class SortsByLikes
{
    public const SORT = 'lcoyLikes';

    public const COLUMN = 'lcoy_likes';

    public static function requested(SearchCriteria $criteria): bool
    {
        return is_array($criteria->sort) && array_key_exists(self::SORT, $criteria->sort);
    }

    /**
     * 以 `lcoy_likes` 列表示的点赞计数，针对 id 位于 `$postIdColumn`
     * 的帖子。
     *
     * 使用带键的 `addSelect` 而非 `selectRaw`：当 SELECT 仍为空时，
     * Laravel 会把 `表名.*` 放在子查询之前；若用 `selectRaw`，就只剩
     * 计数，缺少模型的列。
     */
    public static function addColumn(Builder $query, string $postIdColumn): void
    {
        $query->addSelect([
            self::COLUMN => static function ($sub) use ($postIdColumn): void {
                $sub->selectRaw('count(*)')
                    ->from('post_likes')
                    ->whereColumn('post_likes.post_id', $postIdColumn);
            },
        ]);
    }
}
