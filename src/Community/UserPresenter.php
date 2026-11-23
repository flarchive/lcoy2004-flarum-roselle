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

namespace Lcoy\Roselle\Community;

use Flarum\Group\Group;
use Flarum\Http\SlugManager;
use Flarum\User\User;

/**
 * 把用户转换成 JSON:API 资源对象（`type: users`），只包含社区页面展示
 * 所需的字段。
 *
 * 主题的端点不经过 UserResource——/api/users 要求搜索权限，而"关于"页面
 * 不能要求该权限——但返回相同的格式可以让论坛把这些用户放入 store
 * （`pushObject`），并直接使用 Avatar、`username()` 和核心的资料路由，
 * 无需适配。
 *
 * 可见性规则与 UserResource 一致：`lastSeenAt` 仅在用户公开在线状态或
 * 操作者有权查看时出现，隐藏的组也只对有权查看者显示。
 */
final class UserPresenter
{
    public function __construct(
        private readonly SlugManager $slugManager
    ) {
    }

    /**
     * @param iterable<User> $users
     * @return list<array<string, mixed>>
     */
    public function many(iterable $users, User $actor): array
    {
        $resources = [];

        foreach ($users as $user) {
            $resources[] = $this->one($user, $actor);
        }

        return $resources;
    }

    /** @return array<string, mixed> */
    public function one(User $user, User $actor): array
    {
        $groups = $user->groups;

        if (! $actor->can('viewHiddenGroups')) {
            $groups = $groups->filter(fn (Group $group) => ! $group->is_hidden);
        }

        $attributes = [
            'username' => $user->username,
            'displayName' => $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'slug' => $this->slugManager->forResource(User::class)->toSlug($user),
            'joinTime' => $user->joined_at?->toAtomString(),
            'discussionCount' => (int) $user->discussion_count,
            'commentCount' => (int) $user->comment_count,
        ];

        if ($user->getPreference('discloseOnline') || $actor->can('viewLastSeenAt', $user)) {
            $attributes['lastSeenAt'] = $user->last_seen_at?->toAtomString();
        }

        return [
            'type' => 'users',
            'id' => (string) $user->id,
            'attributes' => $attributes,
            'relationships' => [
                'groups' => [
                    'data' => $groups->values()->map(fn (Group $group) => ['type' => 'groups', 'id' => (string) $group->id])->all(),
                ],
            ],
        ];
    }
}
