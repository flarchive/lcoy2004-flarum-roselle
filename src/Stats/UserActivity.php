<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Discourse 资料摘要中的数字：访问天数、阅读时长（总计和最近 60 天）、
 * 已读帖子数以及给出/收到的点赞数。
 *
 * 每个用户只计算一次，并保存到请求结束：API 资源会分别请求各个属性，
 * 若没有这层记忆，就会变成五次数据库往返而不是三次。
 */
final class UserActivity
{
    /** Discourse 的"近期阅读时长"统计最近 60 天。 */
    public const RECENT_DAYS = 60;

    /** @var array<int, array<string, int|null>> */
    private array $memo = [];

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    public function get(User $user, string $stat): ?int
    {
        return $this->summary($user)[$stat] ?? null;
    }

    /**
     * @return array<string, int|null> 未启用 flarum-likes 时点赞数为 null，
     *                                 以便资料页隐藏该项统计而不是显示 0
     */
    public function summary(User $user): array
    {
        $id = (int) $user->id;

        if (isset($this->memo[$id])) {
            return $this->memo[$id];
        }

        $recentSince = Carbon::now()->subDays(self::RECENT_DAYS)->toDateString();

        // 该表按天存储：总量和“最近 60 天”可以在同一次查询里求和。
        $visits = $this->db->table(VisitRecorder::TABLE)
            ->where('user_id', $id)
            ->selectRaw(
                'COUNT(*) AS days, COALESCE(SUM(time_read), 0) AS time_read, COALESCE(SUM(posts_read), 0) AS posts_read, COALESCE(SUM(CASE WHEN visited_at >= ? THEN time_read ELSE 0 END), 0) AS recent_time_read',
                [$recentSince]
            )
            ->first();

        $summary = [
            'daysVisited' => (int) ($visits->days ?? 0),
            'timeRead' => (int) ($visits->time_read ?? 0),
            'recentTimeRead' => (int) ($visits->recent_time_read ?? 0),
            'postsRead' => (int) ($visits->posts_read ?? 0),
            'likesGiven' => null,
            'likesReceived' => null,
        ];

        if ($this->extensions->isEnabled('flarum-likes')) {
            $summary['likesGiven'] = $this->db->table('post_likes')->where('user_id', $id)->count();
            $summary['likesReceived'] = $this->db->table('post_likes')
                ->join('posts', 'posts.id', '=', 'post_likes.post_id')
                ->where('posts.user_id', $id)
                // 点赞自己的帖子不算他人的认可。
                ->where('post_likes.user_id', '!=', $id)
                ->count();
        }

        return $this->memo[$id] = $summary;
    }
}
