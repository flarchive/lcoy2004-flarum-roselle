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

namespace Lcoy\Roselle\Topic\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Http\SlugManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * 主题的参与者，用于列表中的头像栏：作者在最前，随后是最后回复的人，
 * 最多五个——四个可见，第五个只用于让 "+" 知道还有更多人。
 *
 * 以精简属性（id、名称、slug 和头像）返回，而不是 `users` 关联：每个
 * 被包含的用户都会变成完整的资源，而各扩展（徽章、排名、分组、条款）
 * 会为每个人做 2 到 4 次查询——20 行列表会从 45 次查询涨到约 250 次。
 *
 * 整个列表每页只通过两次查询解析：Index 在序列化前调用
 * {@see prefetch()}，而 getter 只读取映射。
 */
final class DiscussionParticipantsField
{
    /** 可见的头像数；第五个（若存在）会变成 "+"。 */
    private const SHOWN = 4;

    /**
     * 当前页的参与者，按主题 id 索引。只存在于当前请求中
     * （PHP 每次请求都会重置状态），与核心自身的缓冲区相同。
     *
     * @var array<int, User[]>|null
     */
    private static ?array $page = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly SlugManager $slugs
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('lcoyParticipants')
                // 在主题页面中不存在头像栏。
                ->visible(fn (Discussion $discussion, Context $context): bool => ! $context->showing(DiscussionResource::class))
                ->get(fn (Discussion $discussion): array => array_map(
                    fn (User $user): array => $this->shrink($user),
                    self::forDiscussion($discussion)
                )),
        ];
    }

    /**
     * 填充页面映射：所有主题的所有参与者只用两次查询（分组的帖子 + 用户），
     * 而不是每行两次。
     *
     * @param iterable<mixed> $models
     */
    public function prefetch(iterable $models): void
    {
        $discussions = [];

        foreach ($models as $model) {
            if ($model instanceof Discussion && $model->id !== null) {
                $discussions[(int) $model->id] = $model;
            }
        }

        self::$page = [];

        if ($discussions === []) {
            return;
        }

        // 每个（主题, 帖子作者）一行；MAX 给出最后回复者的顺序。
        // 分组的工作交给数据库，而不是 PHP。
        // 原始片段不会经过 Flarum 的表前缀处理：完整名称需要手写。
        $posts = $this->db->getTablePrefix().'posts';

        $rows = $this->db->table('posts')
            ->selectRaw("{$posts}.discussion_id as discussion_id, {$posts}.user_id as user_id, MAX({$posts}.id) as last_post_id")
            ->whereIn('posts.discussion_id', array_keys($discussions))
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false)
            ->whereNull('posts.hidden_at')
            ->whereNotNull('posts.user_id')
            ->groupBy('posts.discussion_id', 'posts.user_id')
            ->get();

        /** @var array<int, array<int, int>> $ultimoPost user_id => 最后一条帖子 */
        $ultimoPost = [];

        foreach ($rows as $row) {
            $ultimoPost[(int) $row->discussion_id][(int) $row->user_id] = (int) $row->last_post_id;
        }

        // 每个主题需要的 id：作者在前，其余
        // 按最后发帖顺序排列，最多五个。
        /** @var array<int, int[]> $idsPorDiscussao */
        $idsPorDiscussao = [];
        $todosOsIds = [];

        foreach ($discussions as $id => $discussion) {
            $authorId = $discussion->user_id !== null ? (int) $discussion->user_id : null;
            $outros = $ultimoPost[$id] ?? [];

            if ($authorId !== null) {
                unset($outros[$authorId]);
            }

            arsort($outros);

            $ids = array_slice(array_keys($outros), 0, $authorId !== null ? self::SHOWN : self::SHOWN + 1);

            if ($authorId !== null) {
                array_unshift($ids, $authorId);
            }

            $idsPorDiscussao[$id] = $ids;
            $todosOsIds = array_merge($todosOsIds, $ids);
        }

        $users = $todosOsIds === []
            ? []
            : User::query()->whereIn('id', array_values(array_unique($todosOsIds)))->get()->keyBy('id');

        foreach ($idsPorDiscussao as $id => $ids) {
            self::$page[$id] = array_values(array_filter(array_map(
                static fn (int $userId): ?User => $users->get($userId),
                $ids
            )));
        }
    }

    /**
     * 当前页的列表，或——在 Index 之外——该主题的单独查询。
     *
     * @return User[]
     */
    private static function forDiscussion(Discussion $discussion): array
    {
        $id = (int) $discussion->id;

        if (self::$page !== null && array_key_exists($id, self::$page)) {
            return self::$page[$id];
        }

        return resolve(self::class)->queryOne($discussion);
    }

    /**
     * 只包含列表中头像所需绘制的内容。
     *
     * @return array{id: string, username: string, displayName: string, slug: string, avatarUrl: string|null, avatarSrcset: string|null}
     */
    private function shrink(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'username' => (string) $user->username,
            // 与核心模型相同的回退：没有显示名称时，
            // 显示的就是 username。
            'displayName' => (string) ($user->display_name ?: $user->username),
            'slug' => $this->slugs->forResource(User::class)->toSlug($user),
            'avatarUrl' => $user->avatar_url,
            'avatarSrcset' => $user->avatar_srcset,
        ];
    }

    /**
     * @return User[]
     */
    private function queryOne(Discussion $discussion): array
    {
        $author = $discussion->user;

        // `MAX(...)` 使用原生 SQL，而 Flarum 在编译时会为表加前缀：
        // 这里的名称需要连接的表前缀。
        $latest = 'MAX('.$this->db->getTablePrefix().'posts.id) DESC';

        $others = User::query()
            ->select('users.*')
            ->join('posts', 'posts.user_id', '=', 'users.id')
            ->where('posts.discussion_id', $discussion->id)
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false)
            ->whereNull('posts.hidden_at')
            ->when($author, fn ($query) => $query->where('users.id', '!=', $author->id))
            ->groupBy('users.id')
            ->orderByRaw($latest)
            ->limit($author ? self::SHOWN : self::SHOWN + 1)
            ->get()
            ->all();

        return $author ? array_merge([$author], $others) : $others;
    }
}
