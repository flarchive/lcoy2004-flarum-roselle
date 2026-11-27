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

use Flarum\Discussion\Discussion;
use Flarum\Http\UrlGenerator;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Flarum\Post\Post;
use Flarum\User\User;
use Lcoy\Roselle\Gaps\GapsSettings;
use Lcoy\Roselle\Gaps\Notification\TopicLinkedBlueprint;

/**
 * "某某引用了你的主题"——即 Discourse 的 `linked`：新帖子（或被编辑的
 * 帖子）中链接到他人的主题时，通知该主题的作者。
 *
 * 链接在帖子正文中查找，指向本论坛（/d/123 或完整地址）。每个帖子最多
 * 处理少数几个：一串链接不能变成通知轰炸。
 */
final class NotifyTopicLinked
{
    private const MAX_LINKS = 5;

    public function __construct(
        private readonly NotificationSyncer $notifications,
        private readonly GapsSettings $gaps,
        private readonly UrlGenerator $url,
    ) {
    }

    public function handle(Posted|Revised $event): void
    {
        $post = $event->post;
        $actor = $event->actor ?? $post->user;

        if (! $this->gaps->on(GapsSettings::TOPIC_LINKED) || ! $post instanceof CommentPost || ! $actor) {
            return;
        }

        foreach ($this->linkedDiscussionIds($post) as $id) {
            $discussion = Discussion::query()->find($id);
            $author = $discussion?->user;

            if (! $author instanceof User || (int) $author->id === (int) $actor->id) {
                continue;
            }

            // 作者必须能看到发出该链接的帖子。
            if (! Post::query()->whereVisibleTo($author)->whereKey($post->id)->exists()) {
                continue;
            }

            $this->notifications->sync(new TopicLinkedBlueprint($post, $actor, (int) $id), [$author]);
        }
    }

    /** @return list<int> */
    private function linkedDiscussionIds(CommentPost $post): array
    {
        $text = (string) $post->content;
        $base = preg_quote(rtrim($this->url->to('forum')->base(), '/'), '#');
        $path = preg_quote((string) parse_url($this->url->to('forum')->base(), PHP_URL_PATH), '#');

        // 论坛的完整地址或其路径，后接 /d/{id}。
        preg_match_all('#(?:'.$base.'|(?<![\w/.])'.$path.')/d/(\d+)#i', $text, $matches);

        $ids = array_values(array_unique(array_map('intval', $matches[1] ?? [])));
        $ids = array_filter($ids, fn (int $id) => $id > 0 && $id !== (int) $post->discussion_id);

        return array_slice(array_values($ids), 0, self::MAX_LINKS);
    }
}
