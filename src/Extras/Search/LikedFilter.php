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

/**
 * `filter[lcoyLiked]`：搜索者点赞过其中某个帖子的主题（Discourse 的
 * "我赞过的"）。
 *
 * flarum/likes 只能按点赞者对帖子进行过滤（`likedBy`）；在主题搜索中，
 * 等价条件是"含有我点赞过的帖子"。该值会被忽略，始终以当前操作者为准：
 * 按主题汇总他人的点赞并非公开信息，过滤器不能变成发现它们的手段。
 *
 * 仅在启用 flarum/likes 时注册（该表属于此扩展）。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class LikedFilter implements FilterInterface
{
    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyLiked';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $query = $state->getQuery();

        if ($actor->isGuest()) {
            // 访客不会点赞："我赞过的"查不到任何结果，而取反的
            // 过滤器也不会限制任何内容。
            if (! $negate) {
                $query->whereRaw('1 = 0');
            }

            return;
        }

        $likedByActor = static function (Builder $sub) use ($actor): void {
            $sub->selectRaw('1')
                ->from('post_likes')
                ->join('posts as lcoy_liked_posts', 'lcoy_liked_posts.id', '=', 'post_likes.post_id')
                ->whereColumn('lcoy_liked_posts.discussion_id', 'discussions.id')
                ->where('post_likes.user_id', $actor->id);
        };

        if ($negate) {
            $query->whereNotExists($likedByActor);
        } else {
            $query->whereExists($likedByActor);
        }
    }
}
