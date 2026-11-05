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

namespace Lcoy\Roselle\Bookmarks\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Post\Post;
use Flarum\User\User;
use Lcoy\Roselle\Bookmarks\Bookmark;

/**
 * "书签提醒"：定时命令在所选时间到达时发出的通知。
 *
 * 主题对象是帖子而非书签：通知会引导到该帖子，而核心的
 * NotificationResource 已能序列化帖子（含其主题）。书签名称放在数据中，
 * 以便通知像 Discourse 那样展示它。
 *
 * 提醒时间也被有意放进数据：核心通过数据判断通知是否"相同"，若没有它，
 * 同一帖子上的第二个提醒只会重新激活第一个，而不会再次提醒。
 */
final class BookmarkReminderBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Bookmark $bookmark,
        public readonly Post $post,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->post;
    }

    /** 提醒没有发送者：就是用户自己在过去设定的那次。 */
    #[\Override]
    public function getFromUser(): ?User
    {
        return null;
    }

    #[\Override]
    public function getData(): mixed
    {
        return [
            'bookmarkId' => $this->bookmark->id,
            'name' => $this->bookmark->name,
            'reminderAt' => $this->bookmark->reminder_at?->toIso8601String(),
        ];
    }

    #[\Override]
    public static function getType(): string
    {
        return 'lcoyBookmarkReminder';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Post::class;
    }
}
