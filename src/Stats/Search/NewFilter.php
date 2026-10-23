<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Lcoy\Roselle\Stats\TopicCounter;

/**
 * `filter[lcoyNew]=1`——Discourse 的"新帖"选项卡：只包含用户从未打开过的
 * 主题，规则与"新帖 (N)"计数相同。
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class NewFilter implements FilterInterface
{
    public function __construct(
        private readonly TopicCounter $counter
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'lcoyNew';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();

        // 对访客而言没有个人的"新帖"：列表保持原样。
        if ($actor->isGuest() || $negate) {
            return;
        }

        $this->counter->constrainNew($state->getQuery(), $actor);
    }
}
