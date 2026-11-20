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

/*
 * Discourse 的社区页面：关于（/about）、用户（/u）和
 * 群组（/g 与 /g/:名称）。
 */

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\GroupResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Settings\Event\Saving;
use Lcoy\Roselle\Community\AboutPages;
use Lcoy\Roselle\Community\Api\ShowAboutPageController;
use Lcoy\Roselle\Community\Content\AboutPageContent;
use Lcoy\Roselle\Community\Api\CreateGuidelinesPageController;
use Lcoy\Roselle\Community\Api\GroupFields;
use Lcoy\Roselle\Community\Api\ListDirectoryController;
use Lcoy\Roselle\Community\Api\ListGroupActivityController;
use Lcoy\Roselle\Community\Api\ShowAboutController;
use Lcoy\Roselle\Community\Api\ShowGuidelinesController;
use Lcoy\Roselle\Community\Community;
use Lcoy\Roselle\Community\Content\CommunityPage;
use Lcoy\Roselle\Community\Http\LegalPageRedirect;
use Lcoy\Roselle\Community\LegalPages;

/*
 * 这里不要留下散落的变量：主 extend.php 会在自身作用域内 `require` 这个
 * 文件，这里的 `$settings` 会覆盖它的。
 */
return [
    // "关于" 文本、联系方式与页面选项都不进入论坛 payload：
    // 只有 "关于" 页面用到它们，且由该页面自己的端点提供。
    (new Extend\Settings())
        ->default(Community::ABOUT_ENABLED, true)
        ->serializeToForum('lcoyAboutEnabled', Community::ABOUT_ENABLED, 'boolval')
        ->default(Community::ABOUT_TEXT, '')
        ->default(Community::ABOUT_CONTACT_EMAIL, '')
        ->default(Community::ABOUT_CONTACT_URL, '')
        ->default(Community::ABOUT_SHOW_STAFF, true)
        ->default(Community::ABOUT_SHOW_STATS, true)
        // 社区准则、条款与隐私（Discourse 关于页的标签）。
        ->default(Community::GUIDELINES_ENABLED, true)
        ->serializeToForum('lcoyGuidelinesEnabled', Community::GUIDELINES_ENABLED, 'boolval')
        ->default(Community::GUIDELINES_TEXT, '')
        ->default(Community::ABOUT_PAGES, '[]')
        ->default(Community::TOS_URL, '')
        ->default(Community::PRIVACY_URL, '')
        ->default(Community::DIRECTORY_GUESTS, false)
        ->default(Community::GROUPS_ENABLED, true)
        ->serializeToForum('lcoyGroupsEnabled', Community::GROUPS_ENABLED, 'boolval')
        ->default(Community::GROUPS_ACTIVITY, true)
        ->serializeToForum('lcoyGroupsActivity', Community::GROUPS_ACTIVITY, 'boolval')
        ->default(Community::GROUPS_PROFILE_LINKS, true)
        ->serializeToForum('lcoyGroupsProfileLinks', Community::GROUPS_PROFILE_LINKS, 'boolval'),

    (new Extend\Routes('api'))
        ->get('/lcoy-about', 'lcoy.about', ShowAboutController::class)
        ->get('/lcoy-guidelines', 'lcoy.guidelines', ShowGuidelinesController::class)
        ->post('/lcoy-guidelines/page', 'lcoy.guidelines.page', CreateGuidelinesPageController::class)
        ->get('/lcoy-about-pages/{id:\d+}', 'lcoy.about_pages.show', ShowAboutPageController::class)
        ->get('/lcoy-directory', 'lcoy.directory', ListDirectoryController::class)
        ->get('/lcoy-groups/{id:\d+}/activity', 'lcoy.groups.activity', ListGroupActivityController::class),

    (new Extend\Frontend('forum'))
        ->route('/about', 'lcoy.about', CommunityPage::for(Community::ABOUT_ENABLED, 'about.title'))
        ->route('/guidelines', 'lcoy.guidelines', CommunityPage::for(Community::GUIDELINES_ENABLED, 'guidelines.title'))
        ->route('/faq', 'lcoy.faq', CommunityPage::for(Community::GUIDELINES_ENABLED, 'guidelines.title'))
        // 关于区域的额外标签（管理员选择的 fof/pages 页面），
        // id 放在前面，与核心的 /d/{id} 相同。不与 fof/pages 的 /p/{id} 和
        // /pages/home 冲突。
        ->route('/about/{page:\d+(?:-[^/]*)?}', 'lcoy.about_page', AboutPageContent::class)
        ->route('/g', 'lcoy.groups', CommunityPage::for(Community::GROUPS_ENABLED, 'groups.title'))
        ->route('/g/{name}', 'lcoy.group', CommunityPage::for(Community::GROUPS_ENABLED, 'groups.title')),

    // /tos 和 /privacy 指向政策地址（fof/terms 或管理员）。
    (new Extend\Routes('forum'))
        ->get('/{page:tos|privacy}', 'lcoy.legal', LegalPageRedirect::class),

    // 当前操作者能否查看群组成员 —— 论坛借此隐藏列表，
    // 而不是让用户撞上 403。
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('lcoyCanViewDirectory')
                ->get(fn (object $model, Context $context) => resolve(Community::class)->canListUsers($context->getActor())),
            // 带地址的条款/隐私（以及其他政策）标签。
            Schema\Arr::make('lcoyLegalPages')
                ->get(fn () => resolve(LegalPages::class)->all()),
            // 当前操作者可见的关于区域额外标签（没有 fof/pages 时为空）。
            Schema\Arr::make('lcoyAboutPages')
                ->get(fn (object $model, Context $context) => resolve(AboutPages::class)->forForum($context->getActor())),
        ]),

    // 额外标签列表由管理员以 JSON 传入：只保存整数且唯一的 id
    // （不超过 AboutPages::MAX）、简短标签和有效图标。
    (new Extend\Event())
        ->listen(Saving::class, static function (Saving $event): void {
            if (array_key_exists(Community::ABOUT_PAGES, $event->settings)) {
                $event->settings[Community::ABOUT_PAGES] = AboutPages::normalize($event->settings[Community::ABOUT_PAGES]);
            }
        }),

    (new Extend\ApiResource(GroupResource::class))
        ->fields(GroupFields::class),
];
