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

namespace Lcoy\Roselle\ListRoutes;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Search\Filter\TagFilter;

/**
 * 把置顶主题固定在首页和标签页顶部，并按创建时间排序。
 *
 * flarum/sticky 只在默认排序时（请求中没有 `sort`）才固定；主题的
 * "未读"等列表仍会显式请求 `-lastPostedAt`，置顶主题会淹没在列表中间，
 * 因此这里补上同样的排序（"最新"已改用 Flarum 默认排序，不需要这段）。
 * 这里在无搜索、无过滤器（或仅有标签）且按活动排序的列表中，让置顶主题
 * 上浮；它们之间按创建顺序排列（最早创建的置顶在最上方），而不是按最后
 * 活动时间。
 */
final class PinStickiedToTop
{
    public function __construct(private readonly SettingsRepositoryInterface $settings)
    {
    }

    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        if ($state->isFulltextSearch() || ! $this->sortsByActivity($criteria)) {
            return;
        }

        $filters = $state->getActiveFilters();
        $onTag = count($filters) === 1 && $filters[0] instanceof TagFilter;

        if ($filters !== [] && ! $onTag) {
            return;
        }

        if (! $onTag) {
            // 在首页，遵循 flarum/sticky 的"不在此处固定"设置。
            if (! $this->settings->get('flarum-sticky.pin_sticky_on_all_discussions', true)) {
                return;
            }

            // 在"仅未读"的默认排序下，flarum/sticky 自己会构建
            // 一个联合并重新排序：在此处改动排序会破坏它。
            if ($criteria->sortIsDefault && $this->settings->get('flarum-sticky.only_sticky_unread_discussions')) {
                return;
            }
        }

        $builder = $state->getQuery();
        $query = $builder->getQuery();
        $orders = array_values(array_filter(
            is_array($query->orders) ? $query->orders : [],
            static fn (array $order): bool => ($order['column'] ?? null) !== 'is_sticky'
        ));

        // 列名不带表名前缀：在 Flarum 2 中 SELECT 使用
        // `flarum_discussions`（带前缀，没有 `discussions` 别名），因此
        // `discussions.is_sticky` 和 qualifyColumn() 返回的模型名都无法
        // 匹配 FROM。此查询只有 `flarum_discussion_sticky_tag` 的 left join
        // （其中没有这些列），所以不存在歧义——这与 flarum/sticky 和
        // huseyinfiliz/stickiest 的风格一致。
        $query->orders = [
            ['column' => 'is_sticky', 'direction' => 'desc'],
            // 只有置顶主题才带上创建时间；其余为 NULL 平局，
            // 继续沿用请求的排序。
            ['type' => 'Raw', 'sql' => 'CASE WHEN is_sticky = 1 THEN created_at END ASC'],
            ...$orders,
        ];
    }

    private function sortsByActivity(SearchCriteria $criteria): bool
    {
        return $criteria->sortIsDefault || $criteria->sort === ['lastPostedAt' => 'desc'];
    }
}
