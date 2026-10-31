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

    /**
     * 每次访问都会变的数字：比较两次打开的资料就能看出这个人来过。
     * 它们与核心“最后访问”遵循同一条规则——隐藏在线状态的人不显示。
     */
    private const PRESENCE = ['lcoyDaysVisited', 'lcoyTimeRead', 'lcoyRecentTimeRead', 'lcoyPostsRead'];

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly UserActivity $activity
    ) {
    }

    public function __invoke(): array
    {
        $visible = fn (User $user, Context $context): bool => $this->settings->activityEnabled() && $context->showing(UserResource::class);

        $presence = static function (User $user, Context $context): bool {
            $actor = $context->getActor();

            return $user->getPreference('discloseOnline')
                || $actor->id === $user->id
                || $actor->can('viewLastSeenAt', $user);
        };

        $fields = [];

        foreach (self::ATTRIBUTES as $attribute => $stat) {
            $fields[] = Schema\Integer::make($attribute)
                ->nullable()
                ->visible($visible)
                // 返回 null（而不是不出现）：资料隐藏这个数字，其余照常显示。
                ->get(fn (User $user, Context $context) => in_array($attribute, self::PRESENCE, true) && ! $presence($user, $context)
                    ? null
                    : $this->activity->get($user, $stat));
        }

        return $fields;
    }
}
