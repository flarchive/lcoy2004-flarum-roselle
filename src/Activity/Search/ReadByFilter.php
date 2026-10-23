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
use Illuminate\Database\Query\Builder;

/**
 * 个人资料页的"已读"选项卡：列出用户读过的主题，按 `discussion_user.last_read_at`
 * 从新到旧排序。
 *
 * 阅读记录属于个人隐私：对于既不是本人也不是管理员的用户，列表返回为空。
 * 排序通过子查询而非 JOIN 实现，以免 `discussion_user` 的列（如 `user_id`）
 * 覆盖主题自身的列。这些过滤器在核心排序之前执行，因此该排序成为主导排序。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class ReadByFilter implements FilterInterface
{
    public function __construct(
        private readonly ActivityUser $users
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyReadBy';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $user = $this->users->resolve($value, $actor);
        $query = $state->getQuery();

        if ($negate || ! $user || ! ActivityUser::canSeePrivate($actor, $user)) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) $user->id;
        $read = static fn (Builder $sub): Builder => $sub
            ->from('discussion_user')
            ->whereColumn('discussion_user.discussion_id', 'discussions.id')
            ->where('discussion_user.user_id', $userId)
            ->whereNotNull('discussion_user.last_read_at');

        $query->whereExists(static fn (Builder $sub): Builder => $read($sub)->selectRaw('1'));
        $query->orderByDesc(static fn (Builder $sub): Builder => $read($sub)->select('discussion_user.last_read_at')->limit(1));
    }
}
