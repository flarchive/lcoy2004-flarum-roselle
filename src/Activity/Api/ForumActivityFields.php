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

namespace Lcoy\Roselle\Activity\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;

/**
 * 个人资料页显示"活动"子选项卡所需的信息：
 * - `lcoyActivityFilters`：本资源的过滤器存在（"已读"和"投票"依赖它们；
 *   资源关闭后这些选项卡会消失）；
 * - `lcoyCanSeeReactions`：访客能否查看谁做出了反应（fof/reactions
 *   的权限）。没有该权限时，"反应"选项卡会始终为空。
 */
final class ForumActivityFields
{
    /** @return list<Schema\Boolean> */
    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('lcoyActivityFilters')
                ->get(static fn (): bool => true),
            Schema\Boolean::make('lcoyCanSeeReactions')
                ->get(static fn (mixed $forum, Context $context): bool => $context->getActor()->hasPermission('discussion.canSeeReactions')),
        ];
    }
}
