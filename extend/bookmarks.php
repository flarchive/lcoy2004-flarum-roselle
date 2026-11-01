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
 * Discourse 的书签功能（bookmarks）：收藏帖子及整个主题，可命名和设置提醒，
 * 并在个人资料中提供 "书签" 页面。
 *
 * 即使在管理员处关闭了该功能，一切都仍会注册 —— API 路由在启动时装配，
 * 早于配置加载 —— 而每个入口都会查询 `lcoy.bookmarks_enabled`
 * （BookmarksFeature）。
 */

use Flarum\Api\Resource\PostResource;
use Flarum\Extend;
use Lcoy\Roselle\Bookmarks\Access\BookmarkPolicy;
use Lcoy\Roselle\Bookmarks\Access\ScopeBookmarkVisibility;
use Lcoy\Roselle\Bookmarks\Api\BookmarkResource;
use Lcoy\Roselle\Bookmarks\Api\PostBookmarkFields;
use Lcoy\Roselle\Bookmarks\Bookmark;
use Lcoy\Roselle\Bookmarks\BookmarksFeature;
use Lcoy\Roselle\Bookmarks\Console\ReminderSchedule;
use Lcoy\Roselle\Bookmarks\Console\SendBookmarkReminders;
use Lcoy\Roselle\Bookmarks\Notification\BookmarkReminderBlueprint;

return [
    new Extend\ApiResource(BookmarkResource::class),

    (new Extend\ApiResource(PostResource::class))
        ->fields(PostBookmarkFields::class),

    (new Extend\ModelVisibility(Bookmark::class))
        ->scope(ScopeBookmarkVisibility::class),

    (new Extend\Policy())
        ->modelPolicy(Bookmark::class, BookmarkPolicy::class),

    // 仅站内提醒，默认开启。用户可在 设置 → 通知 中关闭，
    // 与其他通知类型一样。
    (new Extend\Notification())
        ->type(BookmarkReminderBlueprint::class, ['alert']),

    (new Extend\Console())
        ->command(SendBookmarkReminders::class)
        ->schedule(SendBookmarkReminders::class, ReminderSchedule::class),

    (new Extend\Settings())
        ->default(BookmarksFeature::ENABLED, true)
        ->default(BookmarksFeature::TOPIC_BUTTON, true)
        ->default(BookmarksFeature::USER_MENU, true)
        ->serializeToForum('lcoyBookmarksEnabled', BookmarksFeature::ENABLED, 'boolval')
        ->serializeToForum('lcoyBookmarksTopicButton', BookmarksFeature::TOPIC_BUTTON, 'boolval')
        ->serializeToForum('lcoyBookmarksUserMenu', BookmarksFeature::USER_MENU, 'boolval'),
];
