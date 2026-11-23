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

namespace Lcoy\Roselle\Community\Api;

use Flarum\Api\Schema;
use Flarum\Group\Group;
use Illuminate\Database\ConnectionInterface;
use Lcoy\Roselle\Community\Community;

/**
 * 组上的 `lcoyMemberCount`，用于 /g 页面的卡片。
 *
 * 组会在每次论坛加载时传输（ForumResource 会包含它们），逐个统计成员
 * 会变成每个页面、每个组一次查询。计数通过一次分组查询完成，并缓存在
 * 该实例上——extender 每次请求会创建一个实例。
 */
final class GroupFields
{
    /** @var array<int, int>|null */
    private ?array $counts = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Community $community,
    ) {
    }

    /** @return list<Schema\Integer> */
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('lcoyMemberCount')
                ->visible(fn () => $this->community->enabled(Community::GROUPS_ENABLED))
                ->get(fn (Group $group) => $this->count($group)),
        ];
    }

    private function count(Group $group): int
    {
        $this->counts ??= $this->db->table('group_user')
            ->select('group_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy('group_id')
            ->pluck('aggregate', 'group_id')
            ->map(fn ($count) => (int) $count)
            ->all();

        return $this->counts[$group->id] ?? 0;
    }
}
