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
 * 补齐 Discourse 缺失功能（gaps）的后端：
 *
 * - "编辑了你的帖子" 和 "关联了你的主题" 通知；
 * - 侧边栏中按分类显示的新动态圆点（lcoyHasUnread）；
 * - 格式化器中的本地日期 [date=…]；
 * - Discourse 的 404 页面（覆盖核心的错误视图）。
 *
 * 关注/静音分类、忽略用户、移动/拆分/合并主题由
 * fof/follow-tags、fof/ignore-users、fof/split 和
 * fof/merge-discussions 负责；主题只提供外观。Markdown 表格由
 * fof/formatting 的 PipeTables 提供。
 *
 * 每个入口都会查询各自的开关（GapsSettings）：关闭后，
 * 路由返回 404，字段消失，通知也不再发出。
 */

use Flarum\Extend;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Lcoy\Roselle\Gaps\Api\TagResourceFields;
use Lcoy\Roselle\Gaps\Formatter\LocalDates;
use Lcoy\Roselle\Gaps\GapsServiceProvider;
use Lcoy\Roselle\Gaps\GapsSettings;
use Lcoy\Roselle\Gaps\Listener\NotifyPostEdited;
use Lcoy\Roselle\Gaps\Listener\NotifyTopicLinked;
use Lcoy\Roselle\Gaps\Notification\PostEditedBlueprint;
use Lcoy\Roselle\Gaps\Notification\TopicLinkedBlueprint;

$settings = (new Extend\Settings())
    // 只有在这个文件被加载时，论坛才会展示依赖服务端的那部分功能：
    // 这个属性就是证据。
    ->default('lcoy.gaps_backend', true)
    ->serializeToForum('lcoyGapsBackend', 'lcoy.gaps_backend', fn () => true);

foreach (GapsSettings::DEFAULTS as $key => $default) {
    $settings->default($key, $default);
}

$settings
    ->serializeToForum('lcoyNotifyPostEdited', GapsSettings::POST_EDITED, 'boolval')
    ->serializeToForum('lcoyNotifyTopicLinked', GapsSettings::TOPIC_LINKED, 'boolval');
// 本地日期由格式化器（服务端）输出：论坛的 JS 不读取该
// 配置，管理员端则从 app.data.settings 读取。

$extenders = [
    $settings,

    (new Extend\ServiceProvider())->register(GapsServiceProvider::class),

    // 通知。仅站内提醒，默认开启；每个人可在
    // 设置 → 通知 中关闭。
    (new Extend\Notification())
        ->type(PostEditedBlueprint::class, ['alert'])
        ->type(TopicLinkedBlueprint::class, ['alert']),

    (new Extend\Event())
        ->listen(Revised::class, NotifyPostEdited::class)
        ->listen(Posted::class, NotifyTopicLinked::class)
        ->listen(Revised::class, NotifyTopicLinked::class),

    // 本地日期。格式化器只构建一次并缓存；
    // 开关只有在清除缓存后才会生效。
    (new Extend\Formatter())
        ->configure(function (s9e\TextFormatter\Configurator $config): void {
            if (resolve(GapsSettings::class)->on(GapsSettings::LOCAL_DATES)) {
                (new LocalDates())($config);
            }
        }),

    // Discourse 的 404 页面：覆盖核心的错误视图。
    (new Extend\View())
        ->namespace('lcoy-roselle-gaps', __DIR__.'/../views/gaps')
        ->extendNamespace('flarum.forum', __DIR__.'/../views/override'),
];

// 按分类的新动态圆点只在装有 flarum/tags 时存在。
if (class_exists(Flarum\Tags\Api\Resource\TagResource::class)) {
    $extenders[] = (new Extend\ApiResource(Flarum\Tags\Api\Resource\TagResource::class))
        ->fields(TagResourceFields::class);
}

return $extenders;
