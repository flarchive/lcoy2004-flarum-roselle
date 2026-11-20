<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Api\Controller;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\RequestUtil;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\TopicCounter;

/**
 * GET /api/lcoy-counts——不重新生成整个论坛文档就能得到"新帖"和"未读"
 * 计数。前端在返回列表时调用它，使选项卡上的"(N)"跟得上用户刚读过的
 * 内容。
 *
 * 带 `?tag=slug` 时，只统计该标签及其子标签中的内容：在分类页面上，
 * 选项卡显示该分类的数字，与 Discourse 一致。
 */
final class ShowTopicCountsController implements RequestHandlerInterface
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly TopicCounter $counter,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->countsEnabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $tagIds = $this->tagIds((string) Arr::get($request->getQueryParams(), 'tag', ''));

        // 请求了标签但它不存在：那里没有可统计的内容。
        if ($tagIds === []) {
            return new JsonResponse(['new' => 0, 'unread' => 0, 'limit' => TopicCounter::LIMIT]);
        }

        return new JsonResponse([
            'new' => $this->counter->newCount($actor, $tagIds ?? []),
            'unread' => $this->counter->unreadCount($actor, $tagIds ?? []),
            'limit' => TopicCounter::LIMIT,
        ]);
    }

    /**
     * 该标签及其子标签；未请求标签时为 null（统计全部）。
     *
     * @return int[]|null
     */
    private function tagIds(string $slug): ?array
    {
        if ($slug === '' || ! $this->extensions->isEnabled('flarum-tags')) {
            return null;
        }

        $id = $this->db->table('tags')->where('slug', $slug)->value('id');

        if ($id === null) {
            return [];
        }

        return $this->db->table('tags')
            ->where('id', $id)
            ->orWhere('parent_id', $id)
            ->pluck('id')
            ->map(fn ($tagId): int => (int) $tagId)
            ->all();
    }
}
