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

namespace Lcoy\Roselle\Gaps\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Post\Post;
use Flarum\User\User;

/**
 * "某某引用了你的主题"——即 Discourse 的 `linked`：他人的帖子中带有指向
 * 你主题的链接。主题对象是带链接的帖子（通知会引导到那里）；
 * 被链接的主题放在数据中。
 */
final class TopicLinkedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Post $post,
        public readonly User $linker,
        public readonly int $linkedDiscussionId,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->post;
    }

    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->linker;
    }

    #[\Override]
    public function getData(): mixed
    {
        return ['discussionId' => $this->linkedDiscussionId];
    }

    #[\Override]
    public static function getType(): string
    {
        return 'lcoyTopicLinked';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Post::class;
    }
}
