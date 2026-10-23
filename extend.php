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

namespace Lcoy\Roselle;

use Flarum\Extend;
use Lcoy\Roselle\Theme\FontFamily;
use Lcoy\Roselle\Theme\Loader\LoaderAdminPayload;
use Lcoy\Roselle\Theme\Loader\LoaderLess;
use Lcoy\Roselle\Theme\Loader\LoaderPresets;
use Lcoy\Roselle\Theme\Loader\SanitizeLoaderSetting;
use Lcoy\Roselle\Theme\Logo\SvgLogoServiceProvider;
use Lcoy\Roselle\Support\RouteConflictGuard;

/*
 * 每个主题配置项：键 => [论坛中的属性, 默认值, 转换]。
 *
 * 只用一张表，因为三个列表（默认值、serializeToForum 和管理端）
 * 必须保持一致 —— 在其中一处遗漏某个键不会报错，
 * 只会让该选项悄无声息地消失。
 */
$forumSettings = [
    // 外观
    'lcoy.tinted_background' => ['lcoyTintedBackground', true, 'boolval'],
    'lcoy.colored_accents' => ['lcoyColoredAccents', true, 'boolval'],
    'lcoy.content_card' => ['lcoyContentCard', true, 'boolval'],
    'lcoy.show_title_with_logo' => ['lcoyShowTitleWithLogo', false, 'boolval'],
    'lcoy.pill_buttons' => ['lcoyPillButtons', true, 'boolval'],
    'lcoy.lucide_icons' => ['lcoyLucideIcons', true, 'boolval'],

    // 侧边栏
    'lcoy.sidebar_enabled' => ['lcoySidebarEnabled', true, 'boolval'],
    'lcoy.sidebar_open_default' => ['lcoySidebarOpenDefault', true, 'boolval'],
    'lcoy.sidebar_new_topic' => ['lcoySidebarNewTopic', true, 'boolval'],
    'lcoy.sidebar_categories' => ['lcoySidebarCategories', true, 'boolval'],
    'lcoy.sidebar_tags' => ['lcoySidebarTags', true, 'boolval'],
    'lcoy.sidebar_tags_limit' => ['lcoySidebarTagsLimit', 6, 'intval'],
    'lcoy.sidebar_footer' => ['lcoySidebarFooter', true, 'boolval'],

    // 页眉
    'lcoy.header_search' => ['lcoyHeaderSearch', true, 'boolval'],

    // 快捷键
    'lcoy.keyboard_shortcuts' => ['lcoyKeyboardShortcuts', true, 'boolval'],
    'lcoy.loading_slider' => ['lcoyLoadingSlider', true, 'boolval'],
    'lcoy.toast_auto_close' => ['lcoyToastAutoClose', true, 'boolval'],

    // 首页
    'lcoy.welcome_banner' => ['lcoyWelcomeBanner', false, 'boolval'],
    'lcoy.welcome_banner_guests_only' => ['lcoyWelcomeBannerGuestsOnly', false, 'boolval'],
    'lcoy.welcome_banner_search' => ['lcoyWelcomeBannerSearch', true, 'boolval'],
    'lcoy.category_hero' => ['lcoyCategoryHero', true, 'boolval'],
    'lcoy.category_hero_children' => ['lcoyCategoryHeroChildren', true, 'boolval'],

    // 列表导航
    'lcoy.nav_hot' => ['lcoyNavHot', true, 'boolval'],
    'lcoy.hot_days' => ['lcoyHotDays', 7, 'intval'],
    'lcoy.nav_unread' => ['lcoyNavUnread', true, 'boolval'],
    'lcoy.nav_categories_link' => ['lcoyNavCategoriesLink', true, 'boolval'],
    'lcoy.nav_dropdowns' => ['lcoyNavDropdowns', true, 'boolval'],
    'lcoy.nav_sticky' => ['lcoyNavSticky', false, 'boolval'],
    'lcoy.list_infinite_scroll' => ['lcoyListInfiniteScroll', true, 'boolval'],

    // 主题列表
    'lcoy.list_header' => ['lcoyListHeader', true, 'boolval'],
    'lcoy.list_posters' => ['lcoyListPosters', true, 'boolval'],
    'lcoy.list_views' => ['lcoyListViews', true, 'boolval'],
    'lcoy.list_heat' => ['lcoyListHeat', true, 'boolval'],
    'lcoy.list_excerpts' => ['lcoyListExcerpts', true, 'boolval'],

    // 分类页
    'lcoy.categories_layout' => ['lcoyCategoriesLayout', 'boxes', null],

    // 主题
    'lcoy.topic_map' => ['lcoyTopicMap', true, 'boolval'],
    'lcoy.topic_event_posts' => ['lcoyTopicEventPosts', true, 'boolval'],
    // 头像随长帖滚动而跟随（类似 avocado 的 "fixedAvatar"）。
    'lcoy.topic_sticky_avatar' => ['lcoyTopicStickyAvatar', false, 'boolval'],
    // 内容卡片的最大宽度（px）；在 PreBootShell 中于首次绘制前应用，
    // 论坛中没有对应属性（首项为 null）。
    'lcoy.content_width' => [null, '1110', null],
    'lcoy.topic_timeline' => ['lcoyTopicTimeline', true, 'boolval'],
    'lcoy.topic_footer' => ['lcoyTopicFooter', true, 'boolval'],
    'lcoy.suggested_topics' => ['lcoySuggestedTopics', true, 'boolval'],
    'lcoy.suggested_count' => ['lcoySuggestedCount', 5, 'intval'],
    'lcoy.user_card' => ['lcoyUserCard', true, 'boolval'],
    'lcoy.user_menu' => ['lcoyUserMenu', true, 'boolval'],
    'lcoy.post_actions' => ['lcoyPostActions', true, 'boolval'],
    'lcoy.embedded_replies' => ['lcoyEmbeddedReplies', true, 'boolval'],
    'lcoy.new_replies_bar' => ['lcoyNewRepliesBar', true, 'boolval'],
    // 帖子样式：'discourse'（默认）或 'direct'（同样的帖子，但用 avocado 的
    // 时间线连接各头像：less/forum/PostDirect.less）。
    'lcoy.post_style' => ['lcoyPostStyle', 'discourse', null],
    // 帖子的 "回复给"：'discourse'（↩ 名字位于页眉右侧）
    // 或 'avocado'（名字下方一行："↳ 回复给 [头像] 张三"）。
    'lcoy.topic_reply_to_style' => ['lcoyTopicReplyToStyle', 'discourse', null],

    // 第三方扩展（Discourse 外观）
    'lcoy.thirdparty_solved' => ['lcoyThirdPartySolved', true, 'boolval'],
    'lcoy.thirdparty_reactions' => ['lcoyThirdPartyReactions', true, 'boolval'],
    'lcoy.thirdparty_polls' => ['lcoyThirdPartyPolls', true, 'boolval'],
    'lcoy.thirdparty_links_sidebar' => ['lcoyThirdPartyLinksSidebar', true, 'boolval'],
    'lcoy.thirdparty_upload_progress' => ['lcoyThirdPartyUploadProgress', true, 'boolval'],
    'lcoy.thirdparty_thumbnails' => ['lcoyThirdPartyThumbnails', true, 'boolval'],
    // forumaker/profile-cover 取代内置封面（thirdparty/profileCover）。
    'lcoy.thirdparty_profile_cover' => ['lcoyThirdPartyProfileCover', true, 'boolval'],

    // 个人资料
    'lcoy.user_cover' => ['lcoyUserCover', true, 'boolval'],
    'lcoy.user_stats' => ['lcoyUserStats', true, 'boolval'],
    'lcoy.user_summary' => ['lcoyUserSummary', true, 'boolval'],
    'lcoy.user_default_tab' => ['lcoyUserDefaultTab', 'summary', null],
    // "活动" 子标签（extend/activity.php），每个都依赖各自的扩展。
    'lcoy.user_activity_read' => ['lcoyUserActivityRead', true, 'boolval'],
    'lcoy.user_activity_reactions' => ['lcoyUserActivityReactions', true, 'boolval'],
    'lcoy.user_activity_votes' => ['lcoyUserActivityVotes', true, 'boolval'],
    'lcoy.user_activity_solved' => ['lcoyUserActivitySolved', true, 'boolval'],

    // 补齐 Discourse 缺失的功能（js/src/forum/gaps）
    'lcoy.post_shortcuts' => ['lcoyPostShortcuts', true, 'boolval'],
    'lcoy.code_buttons' => ['lcoyCodeButtons', true, 'boolval'],
    'lcoy.heading_anchors' => ['lcoyHeadingAnchors', true, 'boolval'],
    'lcoy.table_expand' => ['lcoyTableExpand', true, 'boolval'],
    'lcoy.spoiler_blur' => ['lcoySpoilerBlur', true, 'boolval'],
    'lcoy.mention_cards' => ['lcoyMentionCards', true, 'boolval'],
    'lcoy.post_read_state' => ['lcoyPostReadState', true, 'boolval'],
    'lcoy.timeline_back' => ['lcoyTimelineBack', true, 'boolval'],
    'lcoy.inline_title_editor' => ['lcoyInlineTitleEditor', true, 'boolval'],
    'lcoy.share_modal' => ['lcoyShareModal', true, 'boolval'],
    'lcoy.share_networks' => ['lcoyShareNetworks', 'x,facebook,whatsapp,email', null],
    'lcoy.list_last_visit' => ['lcoyListLastVisit', true, 'boolval'],
    'lcoy.list_dismiss' => ['lcoyListDismiss', true, 'boolval'],
    'lcoy.sidebar_faq_url' => ['lcoySidebarFaqUrl', '', null],
    'lcoy.sidebar_tos_url' => ['lcoySidebarTosUrl', '', null],
    'lcoy.sidebar_privacy_url' => ['lcoySidebarPrivacyUrl', '', null],
    'lcoy.sidebar_custom_title' => ['lcoySidebarCustomTitle', '', null],
    'lcoy.sidebar_custom_links' => ['lcoySidebarCustomLinks', '', null],
    'lcoy.sidebar_home_link' => ['lcoySidebarHomeLink', true, 'boolval'],
    'lcoy.sidebar_home' => ['lcoySidebarHome', 'index', null],
    'lcoy.sidebar_home_url' => ['lcoySidebarHomeUrl', '', null],
    'lcoy.sidebar_category_dots' => ['lcoySidebarCategoryDots', true, 'boolval'],

    // 登录和注册：独立页面（/login、/signup）或核心的弹窗。
    'lcoy.auth_pages' => ['lcoyAuthPages', true, 'boolval'],
];

// 颜色没有自己的配置项：主题从 Flarum 的主色（外观）派生整套调色板，
// 就像 Discourse 的 Horizon 使用其 "tertiary" 一样。只有字体变成 LESS 变量，
// 它的默认值放在这里而不是 LESS 中：配置变量在扩展的样式表之前加载，
// 而在样式表中声明的默认值会覆盖管理员选择的值。
$settings = (new Extend\Settings())
    ->default(FontFamily::SETTING, FontFamily::INTER)
    ->registerLessConfigVar('config-lcoy-font', FontFamily::SETTING, FontFamily::class)
    // 使用 SVG 的加载指示器（less/forum/Loader.less）：图形以 `data:` 形式
    // 写入样式表，每个键都会在变更时重新编译该样式表。
    // 取值来自 LoaderLess，若出现意外情况则回退到 Flarum 的默认值
    // （一个坏值会让整个样式表崩溃）。
    ->default(LoaderLess::STYLE, LoaderPresets::DEFAULT)
    ->default(LoaderLess::CUSTOM, '')
    ->default(LoaderLess::TINT, true)
    ->default(LoaderLess::COLOR, '')
    ->default(LoaderLess::SIZE, 100)
    ->registerLessConfigVar('config-lcoy-loader-on', LoaderLess::STYLE, static fn ($value): string => LoaderLess::on($value))
    ->registerLessConfigVar('config-lcoy-loader-image', LoaderLess::CUSTOM, static fn (): string => LoaderLess::image())
    ->registerLessConfigVar('config-lcoy-loader-still', LoaderLess::CUSTOM, static fn (): string => LoaderLess::still())
    ->registerLessConfigVar('config-lcoy-loader-tint', LoaderLess::TINT, static fn ($value): string => LoaderLess::tint($value))
    ->registerLessConfigVar('config-lcoy-loader-color', LoaderLess::COLOR, static fn ($value): string => LoaderLess::color($value))
    ->registerLessConfigVar('config-lcoy-loader-scale', LoaderLess::SIZE, static fn ($value): string => LoaderLess::scale($value))
    // `registerLessConfigVar` 只读取该键：真正触发样式表重新编译的是
    // `resetJsCacheFor`。没有它，更换字体或指示器时虽然写入了值，
    // 但 CSS 仍保持旧内容，直到有人手动重新编译。
    ->resetJsCacheFor(FontFamily::SETTING)
    ->resetJsCacheFor(LoaderLess::STYLE)
    ->resetJsCacheFor(LoaderLess::CUSTOM)
    ->resetJsCacheFor(LoaderLess::TINT)
    ->resetJsCacheFor(LoaderLess::COLOR)
    ->resetJsCacheFor(LoaderLess::SIZE);

foreach ($forumSettings as $key => [$attributeName, $default, $cast]) {
    $settings->default($key, $default);

    // 没有对应属性：该键在服务端（PreBootShell）读取，而不是在 JS 中。
    if ($attributeName !== null) {
        $settings->serializeToForum($attributeName, $key, $cast);
    }
}

/*
 * 带后端的资源（书签、浏览量、徽章、成员目录……）各自位于
 * extend/<resource>.php 中，各自返回自己的 extender 列表。这样每个资源
 * 都完整地放在一个地方，基础主题不需要了解它们。
 */
$features = [];

// require 在静态闭包中执行，让每个文件拥有自己的作用域：
// 若直接写在这里，某个资源中的 `$settings = …` 会覆盖基础主题的
// `$settings`，后者随后会被注册两次（并丢失默认值）。
$requireFeature = static fn (string $file): array => require $file;

// 只有列在 extend/.enabled 中的资源才会被加载（每行一个）：新资源
// 经过测试后才加入列表，论坛绝不会因为它仍在开发中而崩溃。
//
// 为了在不影响站点用户的情况下测试某个资源，请求可以带上
// `X-Lcoy-Probe: <resource>[,<resource>…]` 请求头，仅对该请求生效。
$readList = static fn (string $text): array => array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $text) ?: [])));
$enabledFile = __DIR__.'/extend/.enabled';
$enabled = is_file($enabledFile) ? $readList((string) file_get_contents($enabledFile)) : [];

if (isset($_SERVER['HTTP_X_LCOY_PROBE'])) {
    $enabled = $readList((string) $_SERVER['HTTP_X_LCOY_PROBE']);
}

$featureFiles = array_filter(
    glob(__DIR__.'/extend/*.php') ?: [],
    static fn (string $file): bool => in_array(basename($file, '.php'), $enabled, true)
);

foreach ($featureFiles as $featureFile) {
    // 加载失败的资源会被排除在外，论坛与其余部分继续运行：
    // 少一个资源总好过整站报 500。
    try {
        $features = array_merge($features, $requireFeature($featureFile));
    } catch (\Throwable $error) {
        error_log(sprintf('[lcoy/roselle] 功能 %s 已停用：%s', basename($featureFile), $error->getMessage()));
    }
}

return [
    ...$features,

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        // 按需加载的 chunk（页面、弹窗）：若不注册该目录，
        // import() 就无处下载文件。
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        // 使用 Lucide 图标（默认）时，`far`（fa-regular，20 KB）只
        // 用于绘制代码块中的复制图标；核心会在每个页面预加载它。
        // 没有预加载时，字体要等图标出现才下载。
        // fa-solid 仍然保留：标签/群组图标和 wardrobe 的图标在每个页面
        // 都会用到。它在核心内容之后运行（优先级 160），由核心放置它们。
        ->content(static function (\Flarum\Frontend\Document $document): void {
            $lucide = resolve(\Flarum\Settings\SettingsRepositoryInterface::class)->get('lcoy.lucide_icons');

            if ($lucide !== null && ! (bool) $lucide) {
                return;
            }

            $document->preloads = array_values(array_filter(
                $document->preloads,
                static fn (array $preload): bool => ! preg_match('#/fonts/fa-regular-400\.woff2#', (string) ($preload['href'] ?? ''))
            ));
        }),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        // 主题的管理面板是一个 chunk（js/src/admin/panel.tsx）。
        ->jsDirectory(__DIR__.'/js/dist/admin')
        ->css(__DIR__.'/less/admin.less')
        // 管理员卡片中加载指示器的现成预览。
        ->content(LoaderAdminPayload::class),

    new Extend\Locales(__DIR__.'/locale'),

    // Flarum 的默认 logo 字段接受 SVG（保存前会先清理）。
    (new Extend\ServiceProvider())->register(SvgLogoServiceProvider::class),

    // 加载指示器自带的 SVG 在写入数据库前会先被清理。
    (new Extend\Event())->listen(\Flarum\Settings\Event\Saving::class, SanitizeLoaderSetting::class),

    // 已被其他扩展占用的主题路由（/chat、/search……）会被移除，
    // 而不是用 BadRouteException 让论坛崩溃。
    (new Extend\ServiceProvider())->register(RouteConflictGuard::class),

    // Wardrobe：每次重新编译时只预热默认主题（见 LazyThemeAssets）。
    (new Extend\Conditional())->whenExtensionEnabled('ernestdefoe-wardrobe', static fn (): array => [
        (new Extend\ServiceProvider())->register(\Lcoy\Roselle\Support\WardrobeServiceProvider::class),
    ]),

    $settings,
];
