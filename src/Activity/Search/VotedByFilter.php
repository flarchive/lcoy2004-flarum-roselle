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
use Flarum\User\User;
use FoF\Polls\Poll;
use Illuminate\Database\ConnectionInterface;

/**
 * 个人资料页的"投票"选项卡：列出用户在 fof/polls 的投票中投过票的那些帖子，
 * 通过 `/api/posts?filter[lcoyVoter]=slug` 访问。
 *
 * 某人投票给谁，只有在投票公开投票者时才是公开信息：规则由 fof 自身提供
 * （`seeVoters`），逐个投票判断。本人可以看到自己的全部投票。
 * 帖子的可见性仍沿用核心规则。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class VotedByFilter implements FilterInterface
{
    /** 每次请求最多评估的投票数：对单个资料页而言足够宽松。 */
    private const MAX_POLLS = 500;

    public function __construct(
        private readonly ActivityUser $users,
        private readonly ConnectionInterface $db
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyVoter';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $user = $this->users->resolve($value, $actor);
        $postIds = $user && ! $negate ? $this->visiblePostIds($actor, $user) : [];

        $state->getQuery()->whereIn('posts.id', $postIds);
    }

    /** @return list<int> */
    private function visiblePostIds(User $actor, User $user): array
    {
        $pollIds = $this->db->table('poll_votes')
            ->where('user_id', (int) $user->id)
            ->orderByDesc('id')
            ->limit(self::MAX_POLLS)
            ->pluck('poll_id')
            ->unique()
            ->all();

        if (! $pollIds) {
            return [];
        }

        $self = $actor->id === $user->id;
        $ids = [];

        foreach (Poll::query()->whereIn('id', $pollIds)->whereNotNull('post_id')->get() as $poll) {
            if ($self || $actor->can('seeVoters', $poll)) {
                $ids[] = (int) $poll->post_id;
            }
        }

        return array_values(array_unique($ids));
    }
}
