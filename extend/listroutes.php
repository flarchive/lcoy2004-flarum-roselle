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
 * Discourse 的主题列表地址：
 *
 * - /latest、/hot、/top、/new 和 /unread 打开列表（JS 按路由
 *   选择排序方式；预加载的文档是默认列表的文档）；
 * - /categories 打开分类页面（TagsPage 会加载标签）；
 * - /c/<slug>[/<id>] 重定向到 /t/<slug>。
 *
 * 不要留下散落的变量：extend.php 会在自身作用域内 `require` 这个文件。
 */

use Flarum\Extend;
use Flarum\Forum\Content\Index;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Search\Database\DatabaseSearchDriver;
use Lcoy\Roselle\ListRoutes\PinStickiedToTop;
use Lcoy\Roselle\ListRoutes\RedirectCategory;

return [
    // 只有在这个文件被加载时，论坛才会把这些标签指向这些地址
    // （否则在 /top 上按 F5 会 404）：这个属性就是证据。
    (new Extend\Settings())
        ->default('lcoy.list_routes_backend', true)
        ->serializeToForum('lcoyListRoutes', 'lcoy.list_routes_backend', fn () => true),

    (new Extend\Frontend('forum'))
        ->route('/latest', 'lcoy.latest', Index::class)
        ->route('/hot', 'lcoy.hot', Index::class)
        ->route('/top', 'lcoy.top', Index::class)
        ->route('/new', 'lcoy.new', Index::class)
        ->route('/unread', 'lcoy.unread', Index::class)
        ->route('/categories', 'lcoy.categories'),

    (new Extend\Routes('forum'))
        ->get('/c/{path:.+}', 'lcoy.category_redirect', RedirectCategory::class),

    // 在首页和标签页置顶，按创建顺序排列（见对应类）。
    (new Extend\Conditional())->whenExtensionEnabled('flarum-sticky', static fn (): array => [
        (new Extend\SearchDriver(DatabaseSearchDriver::class))
            ->addMutator(DiscussionSearcher::class, PinStickiedToTop::class),
    ]),
];
