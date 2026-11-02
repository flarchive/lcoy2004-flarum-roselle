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
 * "某某编辑了你的帖子"——即 Discourse 的 `edited`：管理团队（或其他有权限
 * 的人）修改了你帖子的内容。同一人连续编辑会归并到同一条通知中
 * （blueprint 相同）。
 */
final class PostEditedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Post $post,
        public readonly User $editor,
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
        return $this->editor;
    }

    #[\Override]
    public function getData(): mixed
    {
        return null;
    }

    #[\Override]
    public static function getType(): string
    {
        return 'lcoyPostEdited';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Post::class;
    }
}
