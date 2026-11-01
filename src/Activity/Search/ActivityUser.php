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

namespace Lcoy\Roselle\Activity\Search;

use Flarum\Http\SlugManager;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * 选项卡所属的用户：这些过滤器接收资料页的 slug（类似核心的 `author`），
 * 按 slug 驱动的不同，它可能是用户名，也可能是 id。
 */
final class ActivityUser
{
    public function __construct(
        private readonly SlugManager $slugManager
    ) {
    }

    /** @param string|array<mixed> $value */
    public function resolve(string|array $value, User $actor): ?User
    {
        $slug = trim(is_array($value) ? (string) (reset($value) ?: '') : $value);

        if ($slug === '') {
            return null;
        }

        try {
            $user = $this->slugManager->forResource(User::class)->fromSlug($slug, $actor);
        } catch (ModelNotFoundException) {
            return null;
        }

        return $user instanceof User ? $user : null;
    }

    /** 属于个人隐私的内容（"已读"）：仅本人和管理员可见。 */
    public static function canSeePrivate(User $actor, User $user): bool
    {
        return ! $actor->isGuest() && ($actor->id === $user->id || $actor->isAdmin());
    }
}
