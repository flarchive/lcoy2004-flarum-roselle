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
 * 统计，与 Discourse 一致："新帖 (N)" 和 "未读 (N)" 计数，
 * 以及个人资料摘要中的活动（访问天数、阅读时长、
 * 已读帖子、点赞）。
 *
 * 主题浏览量不在这里：由 fof/discussion-views 负责计数和暴露。
 *
 * 每一部分都在管理员处独立开关。关闭后，该属性会从 API 中消失，
 * 自有路由返回 404 —— 论坛表现得如同它不存在，
 * 而已经保存的数据仍留在那里，等重新开启时使用。
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Search\Database\DatabaseSearchDriver;
use Lcoy\Roselle\Stats\Api\Controller\RecordReadTimeController;
use Lcoy\Roselle\Stats\Api\Controller\ShowTopicCountsController;
use Lcoy\Roselle\Stats\Api\TopicMapFields;
use Lcoy\Roselle\Stats\Api\ForumResourceFields;
use Lcoy\Roselle\Stats\Api\UserResourceFields;
use Lcoy\Roselle\Stats\Http\RecordVisitMiddleware;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\Search\NewFilter;
use Lcoy\Roselle\Stats\Search\UnreadFilter;

return [
    (new Extend\Settings())
        ->default(StatsSettings::HEAT_LOW, StatsSettings::DEFAULT_HEAT_LOW)
        ->serializeToForum('lcoyTopicViewsHeatLow', StatsSettings::HEAT_LOW, 'intval')
        ->default(StatsSettings::HEAT_MEDIUM, StatsSettings::DEFAULT_HEAT_MEDIUM)
        ->serializeToForum('lcoyTopicViewsHeatMedium', StatsSettings::HEAT_MEDIUM, 'intval')
        ->default(StatsSettings::HEAT_HIGH, StatsSettings::DEFAULT_HEAT_HIGH)
        ->serializeToForum('lcoyTopicViewsHeatHigh', StatsSettings::HEAT_HIGH, 'intval')
        ->default(StatsSettings::COUNTS_ENABLED, true)
        ->serializeToForum('lcoyStatsCountsEnabled', StatsSettings::COUNTS_ENABLED, 'boolval')
        ->default(StatsSettings::NEW_DAYS, StatsSettings::DEFAULT_NEW_DAYS)
        ->default(StatsSettings::ACTIVITY_ENABLED, true)
        ->serializeToForum('lcoyStatsActivityEnabled', StatsSettings::ACTIVITY_ENABLED, 'boolval'),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(TopicMapFields::class),

    // "新帖 (N)" / "未读 (N)"。
    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumResourceFields::class),

    // 个人资料的活动摘要。
    (new Extend\ApiResource(UserResource::class))
        ->fields(UserResourceFields::class),

    // "新帖" 和 "未读" 标签页按与计数相同的规则列出。
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, NewFilter::class)
        ->addFilter(DiscussionSearcher::class, UnreadFilter::class),

    (new Extend\Routes('api'))
        ->get('/lcoy-counts', 'lcoy.stats.counts', ShowTopicCountsController::class)
        ->post('/lcoy-read-time', 'lcoy.stats.read_time', RecordReadTimeController::class),

    // 访问日既在加载页面时计入，也在仅通过 API 导航时计入
    // （比如隔夜一直开着的那个标签页）。
    (new Extend\Middleware('forum'))->add(RecordVisitMiddleware::class),
    (new Extend\Middleware('api'))->add(RecordVisitMiddleware::class),
];
