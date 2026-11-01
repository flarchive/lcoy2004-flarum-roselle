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

use Flarum\Group\Group;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\Community;

/**
 * GET /api/lcoy-groups/{id}/activity?page= ——某组成员的近期帖子
 * （Discourse 的"活动"选项卡）。
 *
 * 只返回 id，且已按操作者的可见性过滤：论坛随后通过
 * /api/posts?filter[id]=… 获取帖子，该端点会连同扩展添加的所有内容
 * （点赞、提及）一起序列化，并再次检查可见性。
 * 直接在 /api/posts 上按作者过滤，就得把组内每个成员的名字都放进 URL。
 */
final class ListGroupActivityController implements RequestHandlerInterface
{
    public const PAGE_SIZE = 20;

    private const MAX_PAGE = 50;

    public function __construct(
        private readonly Community $community,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::GROUPS_ENABLED);
        $this->community->assertEnabled(Community::GROUPS_ACTIVITY);

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        $params = $request->getQueryParams();
        $groupId = (int) Arr::get($params, 'id');

        if (in_array($groupId, [Group::GUEST_ID, Group::MEMBER_ID], true) || ! Group::query()->whereVisibleTo($actor)->whereKey($groupId)->exists()) {
            throw new RouteNotFoundException();
        }

        $page = min(self::MAX_PAGE, max(1, (int) Arr::get($params, 'page', 1)));

        $ids = Post::query()
            ->whereVisibleTo($actor)
            ->where('posts.type', 'comment')
            ->whereIn('posts.user_id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId))
            ->orderByDesc('posts.created_at')
            ->offset(($page - 1) * self::PAGE_SIZE)
            ->limit(self::PAGE_SIZE + 1)
            ->pluck('posts.id')
            ->map(fn ($id) => (string) $id)
            ->all();

        return new JsonResponse([
            'data' => array_slice($ids, 0, self::PAGE_SIZE),
            'meta' => [
                'page' => $page,
                'hasMore' => count($ids) > self::PAGE_SIZE,
            ],
        ]);
    }
}
