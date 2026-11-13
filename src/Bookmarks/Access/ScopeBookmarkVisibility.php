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

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * `Bookmark::whereVisibleTo($actor)`：只返回当前操作者自己的书签。访客
 * 没有书签，而这条不可能成立的条件可避免用 null 的 `user_id` 查询。
 */
final class ScopeBookmarkVisibility
{
    public function __invoke(User $actor, Builder $query): void
    {
        if ($actor->isGuest()) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('lcoy_bookmarks.user_id', $actor->id);
    }
}
