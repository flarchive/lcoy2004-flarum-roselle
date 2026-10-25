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

namespace Lcoy\Roselle\UserSummary;

use Flarum\Extension\ExtensionManager;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * GET /api/lcoy-user-summary/{id}——Discourse 资料摘要（`user_summary`）中的
 * 列表：用户最常与谁交流，以及在何处交流。
 *
 * - `mostRepliedTo`：用户回复最多的人（flarum/mentions 的引用承担了
 *   `reply_to_user_id` 的角色）；
 * - `mostLikedBy`：点赞其帖子最多的人；
 * - `mostLiked`：其点赞最多的人；
 * - `topCategories`：其主题和回复最多的分类（主标签）。
 *
 * 全部只统计请求者可见的帖子（私密主题、受限标签、隐藏帖子都被排除），
 * 并且只显示对其可见的人。某个查询失败只会清空对应的列表：资料页绝不会
 * 因为摘要而报错。
 *
 * 响应按（用户, 请求者）缓存几分钟，与 Discourse 对 `user_summary` 的做法
 * 相同（那边是一小时）：资料页每次访问都会预加载摘要，而这是一打针对
 * 帖子的聚合查询。请求者会进入缓存键，因此谁都不会收到只有别人能看到的
 * 内容；用户的帖子数和主题数也会进入键，使其新发的帖子立即出现。
 */
final class ShowUserSummaryController implements RequestHandlerInterface
{
    /** 每个列表的条目数，与 Discourse 一致。 */
    private const LIMIT = 6;

    /** 响应的缓存秒数。 */
    public const CACHE_TTL = 300;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly Cache $cache,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $id = (int) Arr::get($request->getQueryParams(), 'id', 0);

        /** @var User|null $user */
        $user = User::whereVisibleTo($actor)->find($id);

        if (! $user) {
            return new JsonResponse(['errors' => [['status' => '404', 'code' => 'not_found']]], 404);
        }

        $key = sprintf('lcoy.user-summary.%d.%d.%d.%d', $user->id, (int) $actor->id, (int) $user->comment_count, (int) $user->discussion_count);

        return new JsonResponse($this->cache->remember($key, self::CACHE_TTL, fn (): array => $this->summary($user, $actor)));
    }

    /** @return array<string, mixed> */
    private function summary(User $user, User $actor): array
    {
        // 操作者可见的帖子 id：所有统计的基础。
        $visiblePosts = static fn (): Builder => Post::whereVisibleTo($actor)->select('posts.id')->toBase();

        $likes = $this->extensions->isEnabled('flarum-likes');
        $mentions = $this->extensions->isEnabled('flarum-mentions');
        $tags = $this->extensions->isEnabled('flarum-tags');

        // 三个人员列表共用一次查询获取用户。
        $lists = [
            'mostRepliedTo' => $mentions ? $this->safely(fn (): Collection => $this->mostRepliedTo($user, $visiblePosts)) : null,
            'mostLikedBy' => $likes ? $this->safely(fn (): Collection => $this->mostLikedBy($user, $visiblePosts)) : null,
            'mostLiked' => $likes ? $this->safely(fn (): Collection => $this->mostLiked($user, $visiblePosts)) : null,
        ];
        $people = $this->safely(fn (): array => $this->users($lists, $actor));

        // 关闭的列表仍为 null；若用户查询失败，已开启的列表会为空。
        foreach ($lists as $name => $rows) {
            $people[$name] ??= $rows === null ? null : [];
        }

        return [
            'mostRepliedTo' => $people['mostRepliedTo'],
            'mostLikedBy' => $people['mostLikedBy'],
            'mostLiked' => $people['mostLiked'],
            'topCategories' => $tags ? $this->safely(fn (): array => $this->topCategories($user, $actor, $visiblePosts)) : null,
        ];
    }

    /**
     * @template T of array|Collection
     * @param callable(): T $build
     * @return T|array{}
     */
    private function safely(callable $build): array|Collection
    {
        try {
            return $build();
        } catch (\Throwable $error) {
            error_log('[lcoy/roselle] 资料摘要: '.$error->getMessage());

            return [];
        }
    }

    /**
     * @param callable(): Builder $visiblePosts
     * @return Collection<int, object> linhas (user_id, total)
     */
    private function mostRepliedTo(User $user, callable $visiblePosts): Collection
    {
        return $this->db->table('post_mentions_post as m')
            ->join('posts as mine', 'mine.id', '=', 'm.post_id')
            ->join('posts as target', 'target.id', '=', 'm.mentions_post_id')
            ->where('mine.user_id', $user->id)
            ->where('target.user_id', '<>', $user->id)
            ->whereNotNull('target.user_id')
            ->whereIn('mine.id', $visiblePosts())
            ->whereIn('target.id', $visiblePosts())
            ->groupBy('target.user_id')
            ->orderByDesc('total')
            ->limit(self::LIMIT * 2)
            ->select('target.user_id as user_id', $this->db->raw('COUNT(*) as total'))
            ->get();
    }

    /**
     * @param callable(): Builder $visiblePosts
     * @return Collection<int, object> linhas (user_id, total)
     */
    private function mostLikedBy(User $user, callable $visiblePosts): Collection
    {
        return $this->db->table('post_likes as l')
            ->join('posts as p', 'p.id', '=', 'l.post_id')
            ->where('p.user_id', $user->id)
            ->where('l.user_id', '<>', $user->id)
            ->whereIn('p.id', $visiblePosts())
            ->groupBy('l.user_id')
            ->orderByDesc('total')
            ->limit(self::LIMIT * 2)
            ->select('l.user_id as user_id', $this->db->raw('COUNT(*) as total'))
            ->get();
    }

    /**
     * @param callable(): Builder $visiblePosts
     * @return Collection<int, object> linhas (user_id, total)
     */
    private function mostLiked(User $user, callable $visiblePosts): Collection
    {
        return $this->db->table('post_likes as l')
            ->join('posts as p', 'p.id', '=', 'l.post_id')
            ->where('l.user_id', $user->id)
            ->where('p.user_id', '<>', $user->id)
            ->whereNotNull('p.user_id')
            ->whereIn('p.id', $visiblePosts())
            ->groupBy('p.user_id')
            ->orderByDesc('total')
            ->limit(self::LIMIT * 2)
            ->select('p.user_id as user_id', $this->db->raw('COUNT(*) as total'))
            ->get();
    }

    /**
     * 参与最多的分类：用户发起的主题以及在每个主标签中的回复
     * （首帖之后的帖子）。
     *
     * @param callable(): Builder $visiblePosts
     * @return array<int, array<string, mixed>>
     */
    private function topCategories(User $user, User $actor, callable $visiblePosts): array
    {
        // 该类来自 flarum/tags：只有安装它才存在。
        $tagClass = 'Flarum\\Tags\\Tag';

        if (! class_exists($tagClass)) {
            return [];
        }

        $visibleTags = $tagClass::whereVisibleTo($actor)->whereNotNull('position')->select('tags.id')->toBase();

        $rows = $this->db->table('posts as p')
            ->join('discussion_tag as dt', 'dt.discussion_id', '=', 'p.discussion_id')
            ->where('p.user_id', $user->id)
            ->where('p.type', 'comment')
            ->whereIn('p.id', $visiblePosts())
            ->whereIn('dt.tag_id', $visibleTags)
            ->groupBy('dt.tag_id')
            ->select(
                'dt.tag_id as tag_id',
                $this->db->raw('SUM(CASE WHEN p.number = 1 THEN 1 ELSE 0 END) as topics'),
                $this->db->raw('SUM(CASE WHEN p.number > 1 THEN 1 ELSE 0 END) as replies'),
                $this->db->raw('COUNT(*) as total')
            )
            ->orderByDesc('total')
            ->limit(self::LIMIT)
            ->get();

        $tags = $tagClass::whereIn('id', $rows->pluck('tag_id')->all())->get()->keyBy('id');
        $result = [];

        foreach ($rows as $row) {
            $tag = $tags->get($row->tag_id);

            if (! $tag) {
                continue;
            }

            $result[] = [
                'id' => (string) $tag->id,
                'name' => (string) $tag->name,
                'slug' => (string) $tag->slug,
                'color' => $tag->color ?: null,
                'icon' => $tag->icon ?: null,
                'topics' => (int) $row->topics,
                'replies' => (int) $row->replies,
            ];
        }

        return $result;
    }

    /**
     * 各列表（user_id, total）中出现的人，仅限操作者可见者，并带上论坛绘制
     * 头像和链接所需的信息。所有列表共用一次查询。
     *
     * @param array<string, Collection<int, object>|array{}|null> $lists
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function users(array $lists, User $actor): array
    {
        $ids = [];

        foreach ($lists as $rows) {
            foreach ($rows ?? [] as $row) {
                $ids[(int) $row->user_id] = true;
            }
        }

        $users = $ids ? User::whereVisibleTo($actor)->whereIn('id', array_keys($ids))->get()->keyBy('id') : new Collection();
        $result = [];

        foreach ($lists as $name => $rows) {
            if ($rows === null) {
                continue;
            }

            $result[$name] = [];

            foreach ($rows as $row) {
                $other = $users->get((int) $row->user_id);

                if (! $other) {
                    continue;
                }

                $result[$name][] = [
                    'id' => (string) $other->id,
                    'username' => (string) $other->username,
                    'displayName' => (string) $other->display_name,
                    'avatarUrl' => $other->avatar_url,
                    'color' => $other->color ?? null,
                    'count' => (int) $row->total,
                ];

                if (count($result[$name]) >= self::LIMIT) {
                    break;
                }
            }
        }

        return $result;
    }
}
