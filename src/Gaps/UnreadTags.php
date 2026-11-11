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

namespace Lcoy\Roselle\Gaps;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Tags\Tag;
use Flarum\User\User;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * 针对当前查看者，哪些分类和标签有新的或未读的主题——Discourse 侧边栏
 * 中分类旁的小圆点。
 *
 * 每个请求只查询一次（标签会一同出现在论坛文档中），且只看最近两周：
 * 用户从未打开过的旧主题不算"新内容"。
 */
final class UnreadTags
{
    private const DAYS = 14;

    /** @var array<int, array<int, true>> */
    private array $cache = [];

    /** @return array<int, true> 有新内容的标签 id（父标签随子标签一同加入） */
    public function for(User $actor): array
    {
        if ($actor->isGuest()) {
            return [];
        }

        return $this->cache[(int) $actor->id] ??= $this->compute($actor);
    }

    /** @return array<int, true> */
    private function compute(User $actor): array
    {
        $since = Carbon::now()->subDays(self::DAYS);

        foreach ([$actor->joined_at, $actor->marked_all_as_read_at] as $date) {
            if ($date && Carbon::parse($date)->greaterThan($since)) {
                $since = Carbon::parse($date);
            }
        }

        $ids = Discussion::query()
            ->whereVisibleTo($actor)
            ->where('discussions.is_private', false)
            ->whereNull('discussions.hidden_at')
            ->where('discussions.last_posted_at', '>', $since)
            ->where(fn ($query) => $query
                ->whereNotExists(fn (QueryBuilder $state) => $state
                    ->selectRaw('1')
                    ->from('discussion_user')
                    ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                    ->where('discussion_user.user_id', $actor->id))
                ->orWhereExists(fn (QueryBuilder $state) => $state
                    ->selectRaw('1')
                    ->from('discussion_user')
                    ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                    ->where('discussion_user.user_id', $actor->id)
                    ->where(fn (QueryBuilder $read) => $read
                        ->whereNull('discussion_user.last_read_post_number')
                        ->orWhereColumn('discussion_user.last_read_post_number', '<', 'discussions.last_post_number'))))
            ->join('discussion_tag', 'discussion_tag.discussion_id', '=', 'discussions.id')
            ->distinct()
            ->limit(500)
            ->pluck('discussion_tag.tag_id');

        $result = [];

        foreach ($ids as $id) {
            $result[(int) $id] = true;
        }

        // 父分类会与子分类一同点亮，与 Discourse 一致。
        if ($result) {
            foreach (Tag::query()->whereIn('id', array_keys($result))->whereNotNull('parent_id')->pluck('parent_id') as $parent) {
                $result[(int) $parent] = true;
            }
        }

        return $result;
    }
}
