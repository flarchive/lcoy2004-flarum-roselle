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

namespace Lcoy\Roselle\Activity\Api;

use Flarum\Extension\ExtensionManager;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Activity\Search\ActivityUser;

/**
 * 个人资料页的"反应"子选项卡：把点赞（flarum/likes）和反应
 * （fof/reactions）合并到一个列表，按从新到旧排序。在 Lcoy 中
 * 点赞就是"心形"反应，因此对阅读者来说两者是一回事。
 *
 * 只返回 `{postId, reactionId, createdAt}`（`reactionId` 为 null 表示点赞）；
 * 帖子随后通过 `/api/posts?filter[id]=…` 获取，并沿用核心的可见性规则。
 * 这里同样应用可见性：只返回访客可见的帖子，且只有在拥有 fof 的
 * 查看反应者权限时才返回反应。
 */
final class ListReactionsController implements RequestHandlerInterface
{
    private const MAX_LIMIT = 50;

    public function __construct(
        private readonly ActivityUser $users,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();
        $user = $this->users->resolve((string) Arr::get($params, 'username', ''), $actor);
        $offset = max(0, (int) Arr::get($params, 'offset', 0));
        $limit = min(self::MAX_LIMIT, max(1, (int) Arr::get($params, 'limit', 20)));

        $parts = [];
        $visible = static fn () => Post::whereVisibleTo($actor)->select('posts.id');

        if ($user && $this->extensions->isEnabled('flarum-likes')) {
            $parts[] = $this->db->table('post_likes')
                ->select('post_id', $this->db->raw('NULL as reaction_id'), 'created_at')
                ->where('user_id', (int) $user->id)
                ->whereIn('post_id', $visible());
        }

        if ($user && $this->extensions->isEnabled('fof-reactions') && $actor->hasPermission('discussion.canSeeReactions')) {
            $parts[] = $this->db->table('post_reactions')
                ->select('post_id', 'reaction_id', 'created_at')
                ->where('user_id', (int) $user->id)
                ->whereNotNull('reaction_id')
                ->whereIn('post_id', $visible());
        }

        if (! $parts) {
            return new JsonResponse(['data' => [], 'hasMore' => false]);
        }

        $query = array_shift($parts);

        foreach ($parts as $part) {
            $query->unionAll($part);
        }

        // 多取一行，仅用于判断是否还有下一页。
        $rows = $query->newQuery()->fromSub($query, 'lcoy_reactions')
            ->orderByDesc('created_at')
            ->offset($offset)
            ->limit($limit + 1)
            ->get();

        $data = $rows->take($limit)->map(static fn (object $row): array => [
            'postId' => (int) $row->post_id,
            'reactionId' => $row->reaction_id === null ? null : (int) $row->reaction_id,
            'createdAt' => $row->created_at,
        ])->values()->all();

        return new JsonResponse(['data' => $data, 'hasMore' => $rows->count() > $limit]);
    }
}
