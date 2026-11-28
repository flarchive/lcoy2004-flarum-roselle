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

namespace Lcoy\Roselle\Activity\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;

/**
 * `filter[lcoyReplies]=1`：只保留回复，去掉主题的首帖。
 *
 * 个人主页把“讨论”和“回复”分成两个标签页：讨论直接用
 * `DiscussionsUserPage`，回复用核心的帖子流，但核心的帖子流
 *（`filter[type]=comment`）也包含每个主题的首帖，于是新讨论会混在
 * 回复中间。首帖的 `number` 恒为 1，用 `>` 过滤即可；
 * 核心自带的 `number` 过滤器只支持等值，无法表达。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class RepliesOnlyFilter implements FilterInterface
{
    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyReplies';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        // 取反后只留首帖，即该过滤器的精确补集。
        $state->getQuery()->where('posts.number', $negate ? '<=' : '>', 1);
    }
}
