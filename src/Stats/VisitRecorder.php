<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Expression;

/**
 * 每个人的访问天数和阅读时长（lcoy_user_visits）。
 */
final class VisitRecorder
{
    public const TABLE = 'lcoy_user_visits';

    /** 每日上限——一天有 86 400 秒，没有账号能读得比这更多。 */
    public const MAX_TIME_PER_DAY = 86400;

    /** 每日已读帖子上限；超过这个数量就是脚本，而不是阅读。 */
    public const MAX_POSTS_PER_DAY = 10000;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Cache $cache
    ) {
    }

    /**
     * 把今天标记为已访问。它会在每个已认证请求中运行，
     * 因此缓存可让每人每天最多只访问数据库一次。
     */
    public function touch(User $user, bool $mobile): void
    {
        $today = Carbon::now()->toDateString();
        $cacheKey = "lcoy.stats.visit.{$user->id}.{$today}";

        if ($this->cache->has($cacheKey)) {
            return;
        }

        $this->ensureDay($user, $today, $mobile);

        $this->cache->put($cacheKey, true, Carbon::now()->endOfDay());
    }

    /** 把阅读量累加到今天，并遵守每日上限。 */
    public function addReading(User $user, int $seconds, int $posts, bool $mobile): void
    {
        if ($seconds <= 0 && $posts <= 0) {
            return;
        }

        $today = Carbon::now()->toDateString();

        $this->ensureDay($user, $today, $mobile);

        // 上限写在 UPDATE 本身：即使两个选项卡同时累加也能生效，
        // 而在 PHP 中"读取、相加、写入"则无法保证。使用 CASE 而不是
        // LEAST，因为 Flarum 2 同样支持的 SQLite 没有 LEAST。
        $this->db->table(self::TABLE)
            ->where('user_id', $user->id)
            ->where('visited_at', $today)
            ->update([
                'time_read' => $this->cappedSum('time_read', $seconds, self::MAX_TIME_PER_DAY),
                'posts_read' => $this->cappedSum('posts_read', $posts, self::MAX_POSTS_PER_DAY),
            ]);
    }

    private function cappedSum(string $column, int $amount, int $cap): Expression
    {
        $wrapped = $this->db->getQueryGrammar()->wrap($column);
        $amount = max(0, $amount);

        return $this->db->raw("CASE WHEN $wrapped + $amount > $cap THEN $cap ELSE $wrapped + $amount END");
    }

    private function ensureDay(User $user, string $day, bool $mobile): void
    {
        $this->db->table(self::TABLE)->insertOrIgnore([
            'user_id' => $user->id,
            'visited_at' => $day,
            'posts_read' => 0,
            'time_read' => 0,
            'mobile' => $mobile,
        ]);
    }
}
