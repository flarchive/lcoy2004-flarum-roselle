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
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\Community;
use Lcoy\Roselle\Community\Directory;
use Lcoy\Roselle\Community\UserPresenter;

/**
 * GET /api/lcoy-directory?period=&order=&dir=&q=&page=&group=
 *
 * 不带 `group` 时是用户目录（/u）。带 `group` 时是组页面（/g/:nome）的
 * 成员列表——同一张表，只是加了过滤，因此复用同一个端点。两种情况下都
 * 遵循核心的"列出用户"权限：组成员不过是另一种用户列表。
 *
 * 超出预期的值（时间范围、列、页码）会退回默认值而不是报错：论坛的 URL
 * 可以被编辑，保存的链接里的旧参数不应让页面崩溃。
 */
final class ListDirectoryController implements RequestHandlerInterface
{
    /** 超过此范围就属于抓取而非浏览了。 */
    private const MAX_PAGE = 200;

    public function __construct(
        private readonly Community $community,
        private readonly Directory $directory,
        private readonly UserPresenter $presenter,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();

        $groupId = $this->groupId($actor, Arr::get($params, 'group'));

        $this->community->assertEnabled($groupId === null ? Community::DIRECTORY_ENABLED : Community::GROUPS_ENABLED);
        $this->community->assertCanListUsers($actor);

        $columns = $this->directory->columns($actor);
        $sortable = [...$columns, 'username', 'joinedAt'];

        $period = (string) Arr::get($params, 'period', 'all');
        $period = array_key_exists($period, Directory::PERIODS) ? $period : 'all';

        $order = (string) Arr::get($params, 'order', '');
        $order = in_array($order, $sortable, true) ? $order : ($groupId === null ? $this->directory->defaultOrder() : 'username');

        // 未指定方向时，名称按 A 到 Z，数字按从大到小。
        $dir = Arr::get($params, 'dir');
        $ascending = $dir === null || $dir === '' ? $order === 'username' : $dir === 'asc';
        $search = mb_substr(trim((string) Arr::get($params, 'q', '')), 0, 100);
        $page = min(self::MAX_PAGE, max(1, (int) Arr::get($params, 'page', 1)));

        $result = $this->directory->query($actor, $period, $order, $ascending, $search, $page, $groupId);

        return new JsonResponse([
            'data' => array_map(fn (User $user) => [
                'user' => (string) $user->id,
                ...$this->directory->stats($user),
            ], $result['users']),
            'included' => $this->presenter->many($result['users'], $actor),
            'meta' => [
                'columns' => $columns,
                'period' => $period,
                'order' => $order,
                'dir' => $ascending ? 'asc' : 'desc',
                'page' => $page,
                'perPage' => Directory::PAGE_SIZE,
                'total' => $result['total'],
                'hasMore' => $result['hasMore'],
            ],
        ]);
    }

    /**
     * 请求的组，前提是操作者可以看到。访客和成员不是真正的组
     * （没有人会被"加入"它们），也没有对应页面。
     */
    private function groupId(User $actor, mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $id = (int) $value;

        if (in_array($id, [Group::GUEST_ID, Group::MEMBER_ID], true) || ! Group::query()->whereVisibleTo($actor)->whereKey($id)->exists()) {
            throw new RouteNotFoundException();
        }

        return $id;
    }
}
