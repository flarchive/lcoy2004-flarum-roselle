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

namespace Lcoy\Roselle\Community;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Lcoy\Roselle\Support\SchemaCache;

/**
 * 用户目录（/u）和组成员列表（/g/:nome）所用的查询：每个用户及其在
 * 所选时间范围内的活动情况。
 *
 * Discourse 维护一张每小时重算的现成表（`directory_items`）；这里每一列
 * 都是按用户分组的子查询，通过 LEFT JOIN 连接，使排序和分页都在数据库中
 * 完成。只统计公开的主题和回复——不含隐藏或私密内容——与 Discourse
 * 的统计范围一致。
 */
final class Directory
{
    public const PAGE_SIZE = 50;

    /** Discourse 的时间范围 => 回溯天数（`null` = 从始至终）。 */
    public const PERIODS = [
        'all' => null,
        'yearly' => 365,
        'quarterly' => 90,
        'monthly' => 30,
        'weekly' => 7,
        'daily' => 1,
    ];

    /** 主题的 "stats" 功能所使用的访问表（若存在）。 */
    private const VISITS_TABLE = 'lcoy_user_visits';

    /** @var array{date: string, read: string|null}|false|null */
    private array|false|null $visitsSchema = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function hasLikes(): bool
    {
        return $this->extensions->isEnabled('flarum-likes');
    }

    /**
     * 本论坛实际存在的列，按 Discourse 的顺序排列。论坛用该列表构建
     * 表格；按列表之外的列排序会被拒绝。
     *
     * @return list<string>
     */
    public function columns(User $actor, string $period = 'all'): array
    {
        $columns = [];

        if ($this->hasLikes()) {
            array_push($columns, 'likesReceived', 'likesGiven');
        }

        array_push($columns, 'topicCount', 'postCount');

        if (($visits = $this->visitsSchema()) && $this->canSeeVisits($actor, $period)) {
            $columns[] = 'daysVisited';

            if ($visits['read'] !== null) {
                $columns[] = 'postsRead';
            }
        }

        // 按"最后访问"排序会泄露那些隐藏在线状态的人的顺序——
        // 核心只在拥有相同权限时才允许这种排序。
        if ($this->canSortByLastSeen($actor)) {
            $columns[] = 'lastSeenAt';
        }

        return $columns;
    }

    public function canSortByLastSeen(User $actor): bool
    {
        return $actor->hasPermission('user.viewLastSeenAt');
    }

    /**
     * 今天或这一周的访问天数说明谁来过这里——等同于“最后访问”，
     * 而隐藏在线状态的人不显示它。短周期里，访问相关的列沿用
     * 同一权限。
     */
    public function canSeeVisits(User $actor, string $period): bool
    {
        $days = self::PERIODS[$period] ?? null;

        return $days === null || $days > 7 || $this->canSortByLastSeen($actor);
    }

    public function defaultOrder(): string
    {
        return $this->hasLikes() ? 'likesReceived' : 'postCount';
    }

    /**
     * @return array{users: list<User>, total: int, hasMore: bool}
     */
    public function query(User $actor, string $period, string $order, bool $ascending, string $search, int $page, ?int $groupId): array
    {
        $since = self::PERIODS[$period] === null ? null : Carbon::now()->subDays(self::PERIODS[$period]);

        $users = User::query()
            ->whereVisibleTo($actor)
            ->where('users.is_email_confirmed', true);

        if ($groupId !== null) {
            $users->whereIn('users.id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId));
        }

        if ($search !== '') {
            $this->applySearch($users, $search);
        }

        // 总数在 JOIN 之前取得：它只取决于过滤条件。
        $total = (clone $users)->toBase()->getCountForPagination();

        $users->select('users.*');

        $this->joinAggregate($users, 'topicCount', $this->topics($since));
        $this->joinAggregate($users, 'postCount', $this->replies($since));

        if ($this->hasLikes()) {
            $this->joinAggregate($users, 'likesReceived', $this->likesReceived($since));
            $this->joinAggregate($users, 'likesGiven', $this->likesGiven($since));
        }

        if (($visits = $this->visitsSchema()) && $this->canSeeVisits($actor, $period)) {
            $this->joinAggregate($users, 'daysVisited', $this->visits($since, $visits['date'], null));

            if ($visits['read'] !== null) {
                $this->joinAggregate($users, 'postsRead', $this->visits($since, $visits['date'], $visits['read']));
            }
        }

        $direction = $ascending ? 'asc' : 'desc';

        match ($order) {
            'username' => $users->orderBy('users.username', $direction),
            'lastSeenAt' => $users->orderBy('users.last_seen_at', $direction),
            'joinedAt' => $users->orderBy('users.joined_at', $direction),
            default => $users->orderBy(self::alias($order), $direction),
        };

        $rows = $users
            ->orderBy('users.username')
            ->with('groups')
            ->offset(($page - 1) * self::PAGE_SIZE)
            ->limit(self::PAGE_SIZE + 1)
            ->get()
            ->all();

        $hasMore = count($rows) > self::PAGE_SIZE;

        return [
            'users' => array_slice($rows, 0, self::PAGE_SIZE),
            'total' => $total,
            'hasMore' => $hasMore,
        ];
    }

    /**
     * 由 `query()` 返回的用户的活动数字。
     *
     * @return array<string, int>
     */
    public function stats(User $user): array
    {
        $stats = [];

        foreach (['topicCount', 'postCount', 'likesReceived', 'likesGiven', 'daysVisited', 'postsRead'] as $column) {
            $value = $user->getAttribute(self::alias($column));

            if ($value !== null) {
                $stats[$column] = (int) $value;
            }
        }

        return $stats;
    }

    /** SELECT 中计算列的名称，避免与 `users` 的列冲突。 */
    private static function alias(string $column): string
    {
        return 'lcoy_dir_'.strtolower((string) preg_replace('/[A-Z]/', '_$0', $column));
    }

    private function joinAggregate(Builder $users, string $column, QueryBuilder $aggregate): void
    {
        $table = 'cn_'.strtolower($column);
        $grammar = $users->getQuery()->getGrammar();

        $users
            ->leftJoinSub($aggregate, $table, "$table.user_id", '=', 'users.id')
            ->selectRaw('COALESCE('.$grammar->wrap("$table.aggregate").', 0) as '.$grammar->wrap(self::alias($column)));
    }

    private function applySearch(Builder $users, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';
        $hasNickname = resolve(SchemaCache::class)->hasColumn('users', 'nickname');

        $users->where(function (Builder $query) use ($like, $hasNickname) {
            $query->where('users.username', 'like', $like);

            // fof/nicknames 把显示名称存在单独的列里。
            if ($hasNickname) {
                $query->orWhere('users.nickname', 'like', $like);
            }
        });
    }

    private function topics(?Carbon $since): QueryBuilder
    {
        return $this->db->table('discussions')
            ->select('discussions.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->whereNotNull('discussions.user_id')
            ->whereNull('discussions.hidden_at')
            ->where('discussions.is_private', false)
            ->when($since, fn (QueryBuilder $query) => $query->where('discussions.created_at', '>=', $since))
            ->groupBy('discussions.user_id');
    }

    /** Discourse 中的"回复"不包含主题的首帖。 */
    private function replies(?Carbon $since): QueryBuilder
    {
        return $this->publicPosts()
            ->select('posts.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->where('posts.number', '>', 1)
            ->when($since, fn (QueryBuilder $query) => $query->where('posts.created_at', '>=', $since))
            ->groupBy('posts.user_id');
    }

    private function likesReceived(?Carbon $since): QueryBuilder
    {
        return $this->publicPosts()
            ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
            // 点赞自己的帖子（`flarum-likes.like_own_post`）不算
            // 收到的点赞：资料摘要和信任等级
            // 已经将其扣除，而目录此前显示的数量偏大。
            ->whereColumn('post_likes.user_id', '!=', 'posts.user_id')
            ->select('posts.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->when($since, fn (QueryBuilder $query) => $query->where('post_likes.created_at', '>=', $since))
            ->groupBy('posts.user_id');
    }

    private function likesGiven(?Carbon $since): QueryBuilder
    {
        return $this->db->table('post_likes')
            ->select('post_likes.user_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->when($since, fn (QueryBuilder $query) => $query->where('post_likes.created_at', '>=', $since))
            ->groupBy('post_likes.user_id');
    }

    /** 访问天数（每天一行），或在提供 `$sumColumn` 时对其求和。 */
    private function visits(?Carbon $since, string $dateColumn, ?string $sumColumn): QueryBuilder
    {
        $table = self::VISITS_TABLE;
        $query = $this->db->table($table)->select("$table.user_id");
        $grammar = $query->getGrammar();

        $sumColumn === null
            ? $query->selectRaw('COUNT(*) as aggregate')
            : $query->selectRaw('SUM('.$grammar->wrap("$table.$sumColumn").') as aggregate');

        return $query
            ->when($since, fn (QueryBuilder $q) => $q->where("$table.$dateColumn", '>=', $since->toDateString()))
            ->groupBy("$table.user_id");
    }

    private function publicPosts(): QueryBuilder
    {
        return $this->db->table('posts')
            ->whereNotNull('posts.user_id')
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->where('posts.is_private', false)
            ->whereIn('posts.discussion_id', fn (QueryBuilder $discussions) => $discussions
                ->select('id')
                ->from('discussions')
                ->whereNull('hidden_at')
                ->where('is_private', false));
    }

    /**
     * 探测 "stats" 功能所用访问表的列，而不依赖该功能：没有该表时目录仍可
     * 工作，表出现后就多出这些列。
     *
     * @return array{date: string, read: string|null}|null
     */
    private function visitsSchema(): ?array
    {
        if ($this->visitsSchema === null) {
            $this->visitsSchema = false;
            $columns = resolve(SchemaCache::class)->columns(self::VISITS_TABLE) ?? [];

            if (in_array('user_id', $columns, true)) {
                $date = array_values(array_intersect(['visited_at', 'visit_date', 'date', 'visited_on', 'created_at'], $columns))[0] ?? null;
                $read = array_values(array_intersect(['posts_read', 'read_count', 'posts_read_count'], $columns))[0] ?? null;

                if ($date !== null) {
                    $this->visitsSchema = ['date' => $date, 'read' => $read];
                }
            }
        }

        return $this->visitsSchema ?: null;
    }
}
