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
use Illuminate\Database\Query\Builder;
use Lcoy\Roselle\Support\SchemaCache;

/**
 * `filter[lcoyBookmarked]`：Discourse 的"我标记的"——在主题搜索中，是含有
 * 我标记过的帖子的主题；在帖子搜索中，则是我标记的那些帖子本身。
 *
 * 书签是主题的另一项功能（表 `lcoy_bookmarks`），它可能已被关闭，也可能
 * 尚未迁移：没有该表时，过滤器只是查不到任何结果，而不会让搜索崩溃。
 *
 * 始终是当前操作者本人：书签是私密的。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class BookmarkedFilter implements FilterInterface
{
    public const KEY = 'lcoyBookmarked';

    private const TABLE = 'lcoy_bookmarks';

    public function __construct(
        /** 存放帖子 id（`posts.id`）或主题 id（`discussions.id`）的列。 */
        private readonly string $scope = 'discussions',
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return self::KEY;
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $query = $state->getQuery();

        if ($actor->isGuest() || ! $this->tableExists($state)) {
            if (! $negate) {
                $query->whereRaw('1 = 0');
            }

            return;
        }

        $scope = $this->scope;

        $bookmarked = static function (Builder $sub) use ($actor, $scope): void {
            $sub->selectRaw('1')->from(self::TABLE)->where(self::TABLE.'.user_id', $actor->id);

            if ($scope === 'posts') {
                $sub->whereColumn(self::TABLE.'.post_id', 'posts.id');
            } else {
                $sub->join('posts as lcoy_bookmarked_posts', 'lcoy_bookmarked_posts.id', '=', self::TABLE.'.post_id')
                    ->whereColumn('lcoy_bookmarked_posts.discussion_id', 'discussions.id');
            }
        };

        if ($negate) {
            $query->whereNotExists($bookmarked);
        } else {
            $query->whereExists($bookmarked);
        }
    }

    private function tableExists(SearchState $state): bool
    {
        static $exists = null;

        return $exists ??= resolve(SchemaCache::class)->hasTable(self::TABLE);
    }
}
