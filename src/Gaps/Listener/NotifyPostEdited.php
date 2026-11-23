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

namespace Lcoy\Roselle\Gaps\Listener;

use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Event\Revised;
use Flarum\Post\Post;
use Lcoy\Roselle\Gaps\GapsSettings;
use Lcoy\Roselle\Gaps\Notification\PostEditedBlueprint;

/**
 * 当其他人编辑了某人的帖子时通知作者——即 Discourse 的 `edited`。
 * 自己的编辑不会通知任何人。
 */
final class NotifyPostEdited
{
    public function __construct(
        private readonly NotificationSyncer $notifications,
        private readonly GapsSettings $gaps,
    ) {
    }

    public function handle(Revised $event): void
    {
        $post = $event->post;
        $author = $post->user;

        if (! $this->gaps->on(GapsSettings::POST_EDITED) || ! $author || (int) $author->id === (int) $event->actor->id) {
            return;
        }

        // 若作者已看不到该帖子（例如主题被移入受限分类），
        // 就没有可打开的内容。
        if (! Post::query()->whereVisibleTo($author)->whereKey($post->id)->exists()) {
            return;
        }

        $this->notifications->sync(new PostEditedBlueprint($post, $event->actor), [$author]);
    }
}
