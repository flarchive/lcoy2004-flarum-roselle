<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\User\User;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\UserActivity;

/**
 * 用户上的活动统计，仅出现在资料页的响应（Show）中。
 *
 * 在列表里——例如首页每个主题的作者——它们会为每个人产生四次查询，
 * 而这些数字在那里没有人看。核心的 UserPage 在打开资料页时总会通过 Show
 * 补全用户，因此即使该用户已在内存中，这些数字也会到达。
 */
final class UserResourceFields
{
    /** API 属性 => UserActivity 中摘要的键 */
    public const ATTRIBUTES = [
        'lcoyDaysVisited' => 'daysVisited',
        'lcoyTimeRead' => 'timeRead',
        'lcoyRecentTimeRead' => 'recentTimeRead',
        'lcoyPostsRead' => 'postsRead',
        'lcoyLikesGiven' => 'likesGiven',
        'lcoyLikesReceived' => 'likesReceived',
    ];

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly UserActivity $activity
    ) {
    }

    public function __invoke(): array
    {
        $visible = fn (User $user, Context $context): bool => $this->settings->activityEnabled() && $context->showing(UserResource::class);

        $fields = [];

        foreach (self::ATTRIBUTES as $attribute => $stat) {
            $fields[] = Schema\Integer::make($attribute)
                ->nullable()
                ->visible($visible)
                ->get(fn (User $user) => $this->activity->get($user, $stat));
        }

        return $fields;
    }
}
