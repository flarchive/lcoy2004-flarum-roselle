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

namespace Lcoy\Roselle\Bookmarks\Api;

use Closure;
use Illuminate\Database\QueryException;
use Lcoy\Roselle\Bookmarks\Bookmark;

/**
 * 为一次响应中的多个帖子批量加载当前操作者的书签。
 *
 * 帖子进入 API 的途径很多（主题页、通知中附带的帖子、搜索……），而 Eloquent
 * 关联需要在每个端点都做 eager load，否则就会变成 N+1。Flarum 的序列化器
 * 会延迟解析闭包类型的值，并一次性处理整个层级：每个帖子只在这里登记
 * 自己的 id，第一个被解析的闭包用一次查询取出所有已登记帖子的书签——
 * 这与核心 EloquentBuffer 的技巧相同。
 */
final class BookmarkBuffer
{
    /** @var array<int, array<int, true>> 操作者 => 待处理的帖子 id */
    private static array $pending = [];

    /** @var array<int, array<int, Bookmark|null>> 操作者 => 帖子 => 书签（或 null） */
    private static array $loaded = [];

    /**
     * @return Closure(): ?Bookmark
     */
    public static function defer(int $actorId, int $postId): Closure
    {
        if (! array_key_exists($postId, self::$loaded[$actorId] ?? [])) {
            self::$pending[$actorId][$postId] = true;
        }

        return static function () use ($actorId, $postId): ?Bookmark {
            self::resolve($actorId);

            return self::$loaded[$actorId][$postId] ?? null;
        };
    }

    /** 遗忘一个已加载的键值对，使下次读取回到数据库。 */
    public static function forget(int $actorId, int $postId): void
    {
        unset(self::$loaded[$actorId][$postId]);
    }

    private static function resolve(int $actorId): void
    {
        $postIds = array_keys(self::$pending[$actorId] ?? []);

        if (! $postIds) {
            return;
        }

        unset(self::$pending[$actorId]);

        try {
            $found = Bookmark::query()
                ->where('user_id', $actorId)
                ->whereIn('post_id', $postIds)
                ->get()
                ->keyBy('post_id');
        } catch (QueryException $error) {
            // 数据表尚未迁移（主题先于 `migrate` 更新）：
            // 帖子在无书签的状态下返回，而不是让主题页崩溃。
            error_log('[lcoy/roselle] 书签不可用: '.$error->getMessage());
            $found = Bookmark::query()->getModel()->newCollection();
        }

        foreach ($postIds as $postId) {
            self::$loaded[$actorId][$postId] = $found->get($postId);
        }
    }
}
