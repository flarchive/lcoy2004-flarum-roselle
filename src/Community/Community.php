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

namespace Lcoy\Roselle\Community;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;

/**
 * 社区页面的设置键与"谁能看到什么"的规则集中放在一处：API 控制器、
 * 论坛路由的内容以及 `lcoyCanViewDirectory` 属性必须保持一致，否则会
 * 出现链接显示而页面返回 403（或反之）的情况。
 */
final class Community
{
    public const ABOUT_ENABLED = 'lcoy.about_enabled';
    public const ABOUT_TEXT = 'lcoy.about_text';
    public const ABOUT_CONTACT_EMAIL = 'lcoy.about_contact_email';
    public const ABOUT_CONTACT_URL = 'lcoy.about_contact_url';
    public const ABOUT_SHOW_STAFF = 'lcoy.about_show_staff';
    public const ABOUT_SHOW_STATS = 'lcoy.about_show_stats';

    /** "关于"页面中的"指南"、"服务条款"和"隐私政策"选项卡。 */
    public const GUIDELINES_ENABLED = 'lcoy.guidelines_enabled';
    public const GUIDELINES_TEXT = 'lcoy.guidelines_text';

    /** 配合 fof/pages：用作指南的页面 id（为空 = 使用上方的文本）。 */
    public const GUIDELINES_PAGE = 'lcoy.guidelines_page';
    /** 配合 fof/pages：作为"关于"区域额外选项卡的页面（JSON，见 AboutPages）。 */
    public const ABOUT_PAGES = 'lcoy.about_pages';
    public const TOS_URL = 'lcoy.tos_url';
    public const PRIVACY_URL = 'lcoy.privacy_url';

    /** 访客也可以查看组成员（核心的权限只授予成员）。 */
    public const DIRECTORY_GUESTS = 'lcoy.directory_guests';

    public const GROUPS_ENABLED = 'lcoy.groups_enabled';
    public const GROUPS_ACTIVITY = 'lcoy.groups_activity';
    public const GROUPS_PROFILE_LINKS = 'lcoy.groups_profile_links';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public function enabled(string $key): bool
    {
        return (bool) $this->settings->get($key);
    }

    /** 在后台关闭后，页面和 API 都会消失：返回 404 而不是 403。 */
    public function assertEnabled(string $key): void
    {
        if (! $this->enabled($key)) {
            throw new RouteNotFoundException();
        }
    }

    /**
     * 列出用户依赖核心的 `searchUsers` 权限（"查看用户列表"，核心只授予
     * 成员）。管理员可以像 Discourse 默认那样，把组成员列表开放给访客——
     * 但绝不在封闭论坛中开放，那里访客连论坛都看不到。
     */
    public function canListUsers(User $actor): bool
    {
        if ($actor->can('searchUsers')) {
            return true;
        }

        return $actor->isGuest()
            && $actor->can('viewForum')
            && $this->enabled(self::DIRECTORY_GUESTS);
    }

    public function assertCanListUsers(User $actor): void
    {
        if (! $this->canListUsers($actor)) {
            throw new PermissionDeniedException();
        }
    }
}
