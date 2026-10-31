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

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Post\Post;
use Lcoy\Roselle\Bookmarks\Bookmark;
use Lcoy\Roselle\Bookmarks\BookmarksFeature;

/**
 * 当前操作者在每个帖子上的书签：帖子上的按钮需要知道是否已标记，
 * 而"编辑书签"对话框打开时已有内容，无需再获取书签。
 *
 * 仅对已登录且功能已启用的用户可用——对其他用户这些字段根本不会出现。
 * 值来自 BookmarkBuffer，每次响应只查一次。
 */
final class PostBookmarkFields
{
    public function __invoke(): array
    {
        // 设置在一次请求内不变：不要为每个帖子的四个字段重复解析。
        $enabled = BookmarksFeature::enabled();
        $visible = static fn (Post $post, Context $context): bool => ! $context->getActor()->isGuest() && $enabled;

        $bookmark = static fn (Post $post, Context $context) => BookmarkBuffer::defer($context->getActor()->id, $post->id);

        // 每个字段取用同一个延迟书签，并读取其中一部分。
        $read = static fn (callable $pick) => static function (Post $post, Context $context) use ($bookmark, $pick) {
            $resolve = $bookmark($post, $context);

            return static fn () => $pick($resolve());
        };

        return [
            Schema\Boolean::make('bookmarked')
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found): bool => $found !== null)),

            Schema\Integer::make('bookmarkId')
                ->nullable()
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found): ?int => $found?->id)),

            Schema\Str::make('bookmarkName')
                ->nullable()
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found): ?string => $found?->name)),

            Schema\DateTime::make('bookmarkReminderAt')
                ->nullable()
                ->visible($visible)
                ->get($read(static fn (?Bookmark $found) => $found?->reminder_at)),
        ];
    }
}
