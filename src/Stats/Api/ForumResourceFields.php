<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\TopicCounter;

/**
 * 论坛上的"新帖"和"未读"计数，提供给已登录用户。
 *
 * 放在 ForumResource（而非用户）上，是因为它每次页面加载只序列化一次：
 * 当前用户会出现在任何包含其帖子的列表中，而每次出现都会重算这两个
 * 计数。页面加载之后，前端通过 GET /api/lcoy-counts 更新数字。
 */
final class ForumResourceFields
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly TopicCounter $counter
    ) {
    }

    public function __invoke(): array
    {
        $visible = fn (object $model, Context $context): bool => $this->settings->countsEnabled() && ! $context->getActor()->isGuest();

        return [
            Schema\Integer::make('lcoyNewCount')
                ->visible($visible)
                ->get(fn (object $model, Context $context) => $this->counter->newCount($context->getActor())),
            Schema\Integer::make('lcoyUnreadCount')
                ->visible($visible)
                ->get(fn (object $model, Context $context) => $this->counter->unreadCount($context->getActor())),
        ];
    }
}
