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
 * 个人资料中需要服务端支持的 "活动" 子标签，与 Discourse 一致：
 * 已读（仅本人和管理员）、回应（fof/reactions 的点赞与回应合并为一个列表）
 * 和投票（fof/polls）。"已解决" 使用 fof/best-answer 自带的 `solution` 过滤器。
 * 每一部分都只在对应扩展存在时才生效；这些标签在管理员的
 * "个人资料页" 卡片中开关。
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Post\Filter\PostSearcher;
use Flarum\Search\Database\DatabaseSearchDriver;
use Lcoy\Roselle\Activity\Api\ForumActivityFields;
use Lcoy\Roselle\Activity\Api\ListReactionsController;
use Lcoy\Roselle\Activity\Search\ReadByFilter;
use Lcoy\Roselle\Activity\Search\VotedByFilter;

return [
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, ReadByFilter::class),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumActivityFields::class),

    (new Extend\Routes('api'))
        ->get('/lcoy-user-reactions', 'lcoy.activity.reactions', ListReactionsController::class),

    // fof 的类只会在闭包内部被引用：扩展关闭时，这些内容都不会被求值。
    (new Extend\Conditional())
        ->whenExtensionEnabled('fof-polls', static fn (): array => [
            (new Extend\SearchDriver(DatabaseSearchDriver::class))
                ->addFilter(PostSearcher::class, VotedByFilter::class),
        ]),
];
