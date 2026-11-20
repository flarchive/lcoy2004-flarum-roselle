<?php

/*
 * This file is part of lcoy/roselle.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 * Copyright (c) 2026 lcoy
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Discourse 的 "额外" 功能：带高级过滤器的搜索页、
 * 批量选择、按时间段查看 "最佳"、文字大小、打印主题。
 *
 * 每一项都在管理员处独立开关（`lcoy.*_enabled`，默认开启）。
 * 关闭后，论坛不显示其任何内容，路由返回 404。
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Api\Sort\SortColumn;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Post\Filter\PostSearcher;
use Flarum\Search\Database\DatabaseSearchDriver;
use Lcoy\Roselle\Extras\Extras;
use Lcoy\Roselle\Extras\Search\BookmarkedFilter;
use Lcoy\Roselle\Extras\Search\DiscussionSearchMutator;
use Lcoy\Roselle\Extras\Search\LikedFilter;
use Lcoy\Roselle\Extras\Search\MinPostsFilter;
use Lcoy\Roselle\Extras\Search\PostBookmarkedFilter;
use Lcoy\Roselle\Extras\Search\PostSearchMutator;
use Lcoy\Roselle\Extras\Search\SearchPageContent;
use Lcoy\Roselle\Extras\Search\SortsByLikes;

$settings = new Extend\Settings();

/*
 * 键 => [论坛中的属性, 默认值, 转换]。
 */
foreach ([
    Extras::SEARCH_PAGE => ['lcoySearchPageEnabled', true, 'boolval'],
    Extras::BULK_SELECT => ['lcoyBulkSelectEnabled', true, 'boolval'],
    Extras::TOP_PERIODS => ['lcoyTopPeriodsEnabled', true, 'boolval'],
    Extras::TEXT_SIZE => ['lcoyTextSizeEnabled', true, 'boolval'],
    Extras::PRINT_TOPIC => ['lcoyPrintTopicEnabled', true, 'boolval'],
] as $key => [$attributeName, $default, $cast]) {
    $settings->default($key, $default)->serializeToForum($attributeName, $key, $cast);
}

return [
    $settings,

    // ── 搜索页 ───────────────────────────────────────────────────────────────
    (new Extend\Frontend('forum'))
        ->route('/search', 'lcoy.search', SearchPageContent::class),

    // `min-posts:` 和 `in:title` 适用于任何主题搜索（核心的弹窗
    // 也支持），而不只是搜索页。"我标记的" 会读取
    // 书签功能的数据表，若该表不存在则查不到任何内容。
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, MinPostsFilter::class)
        ->addFilter(DiscussionSearcher::class, BookmarkedFilter::class)
        ->addFilter(PostSearcher::class, PostBookmarkedFilter::class)
        ->addMutator(DiscussionSearcher::class, DiscussionSearchMutator::class),

    // "我点赞的" 和 "最多点赞" 依赖 flarum/likes 的数据表。
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-likes', fn () => [
            (new Extend\SearchDriver(DatabaseSearchDriver::class))
                ->addFilter(DiscussionSearcher::class, LikedFilter::class)
                ->addMutator(PostSearcher::class, PostSearchMutator::class),

            (new Extend\ApiResource(DiscussionResource::class))
                ->sorts(fn () => [SortColumn::make(SortsByLikes::SORT)]),

            (new Extend\ApiResource(PostResource::class))
                ->sorts(fn () => [SortColumn::make(SortsByLikes::SORT)]),
        ]),
];
