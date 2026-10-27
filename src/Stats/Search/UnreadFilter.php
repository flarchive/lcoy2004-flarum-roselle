<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Lcoy\Roselle\Stats\TopicCounter;

/**
 * `filter[lcoyUnread]=1`——Discourse 的"未读"选项卡：已打开过但有新回复的
 * 主题，规则与"未读 (N)"计数相同。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class UnreadFilter implements FilterInterface
{
    public function __construct(
        private readonly TopicCounter $counter
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyUnread';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();

        // 对访客而言没有个人的"未读"：列表保持原样。
        if ($actor->isGuest() || $negate) {
            return;
        }

        $this->counter->constrainUnread($state->getQuery(), $actor);
    }
}
