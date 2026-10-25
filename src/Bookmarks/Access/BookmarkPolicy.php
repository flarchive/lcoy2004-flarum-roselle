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

namespace Lcoy\Roselle\Bookmarks\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Lcoy\Roselle\Bookmarks\Bookmark;

/**
 * 书签属于个人：只有所有者可以查看、编辑和删除。
 *
 * 对其他人使用 `forceDeny` 而非 `deny`：若用后者，Gate 会放行管理员，
 * 而即使是管理员也不读取他人的书签（在 Discourse 中同样如此）。
 */
final class BookmarkPolicy extends AbstractPolicy
{
    public function view(User $actor, Bookmark $bookmark): string
    {
        return $this->ownerOnly($actor, $bookmark);
    }

    public function edit(User $actor, Bookmark $bookmark): string
    {
        return $this->ownerOnly($actor, $bookmark);
    }

    public function delete(User $actor, Bookmark $bookmark): string
    {
        return $this->ownerOnly($actor, $bookmark);
    }

    private function ownerOnly(User $actor, Bookmark $bookmark): string
    {
        return ! $actor->isGuest() && $bookmark->user_id === $actor->id ? $this->allow() : $this->forceDeny();
    }
}
