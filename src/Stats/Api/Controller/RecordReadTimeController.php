<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Api\Controller;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Stats\Http\Visitor;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\VisitRecorder;

/**
 * POST /api/lcoy-read-time——简化的 Discourse "timings"：主题页面会不时
 * 上报用户阅读了多少秒，以及哪些帖子在屏幕上出现过。
 *
 * 浏览器并不可信，因此服务端只接受合理的数据：
 * - 秒数绝不能超过自上次上报以来的真实时间（打开两个选项卡时共用同一个
 *   时钟，而不是相加），也不能超过每次上报的上限；
 * - 帖子必须属于所上报的主题，且对上报者可见，每条每天只计一次；
 * - 一整天有总量上限（VisitRecorder）。
 */
final class RecordReadTimeController implements RequestHandlerInterface
{
    /** 前端每 30 秒上报一次；取其两倍为网络延迟留出余量。 */
    public const MAX_SECONDS_PER_CALL = 60;

    /** 第一次上报时没有可比较的先前时钟。 */
    private const FIRST_CALL_SECONDS = 35;

    /** 两次上报之间允许的时钟误差（延迟、取整）。 */
    private const CLOCK_SLACK_SECONDS = 5;

    private const MAX_POSTS_PER_CALL = 50;

    /** 缓存记住今天已读帖子的数量，以避免重复计数。 */
    private const MAX_REMEMBERED_POSTS = 2000;

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly VisitRecorder $visits,
        private readonly Cache $cache
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->activityEnabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = (array) $request->getParsedBody();

        // findOrFail：用户看不到的主题会返回 404，就像
        // 它不存在一样——与 API 在 Show 中的做法一致。
        $discussion = Discussion::query()->whereVisibleTo($actor)->findOrFail((int) Arr::get($body, 'discussionId'));

        $seconds = $this->creditedSeconds((int) $actor->id, (int) Arr::get($body, 'seconds', 0));
        $posts = $this->creditedPosts((int) $actor->id, $discussion, (array) Arr::get($body, 'postIds', []), $actor);

        $this->visits->addReading($actor, $seconds, $posts, (new Visitor($request))->isMobile());

        return new EmptyResponse(204);
    }

    private function creditedSeconds(int $userId, int $claimed): int
    {
        $now = Carbon::now()->getTimestamp();
        $key = "lcoy.stats.read_clock.$userId";
        $last = $this->cache->get($key);

        $allowed = is_int($last) ? max(0, $now - $last + self::CLOCK_SLACK_SECONDS) : self::FIRST_CALL_SECONDS;
        $credited = max(0, min($claimed, $allowed, self::MAX_SECONDS_PER_CALL));

        // 时钟只前进已计入的秒数，而不是推进到"现在"：
        // 这样无论收到多少次上报，所有已计入的时间总和都不会超过自第一次
        // 上报以来的真实时间（再加上一点余量）。若一小时没有上报，时钟
        // 过期并重新开始。
        if ($credited > 0) {
            $this->cache->put($key, is_int($last) ? $last + $credited : $now, 3600);
        }

        return $credited;
    }

    /**
     * @param array<mixed> $postIds
     */
    private function creditedPosts(int $userId, Discussion $discussion, array $postIds, User $actor): int
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $postIds), fn (int $id) => $id > 0)));
        $ids = array_slice($ids, 0, self::MAX_POSTS_PER_CALL);

        if (! $ids) {
            return 0;
        }

        $key = "lcoy.stats.read_posts.$userId.".Carbon::now()->toDateString();
        $seen = (array) $this->cache->get($key, []);
        $ids = array_values(array_diff($ids, $seen));

        if (! $ids) {
            return 0;
        }

        $valid = Post::query()
            ->whereVisibleTo($actor)
            ->where('discussion_id', $discussion->id)
            ->where('type', 'comment')
            ->whereIn('id', $ids)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($valid) {
            $remembered = array_slice(array_merge($seen, $valid), -self::MAX_REMEMBERED_POSTS);
            $this->cache->put($key, $remembered, Carbon::now()->endOfDay());
        }

        return count($valid);
    }
}
