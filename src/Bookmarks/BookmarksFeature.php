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

namespace Lcoy\Roselle\Bookmarks;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * 书签功能的开关（`lcoy.bookmarks_enabled`）。
 *
 * 即使关闭该选项，资源仍会注册——API 路由在 boot 时一次性挂载，当时无法
 * 访问设置——因此每个入口都来这里询问。关闭后，API 返回 404，就像该资源
 * 不存在一样，帖子上的属性也会消失。
 */
final class BookmarksFeature
{
    public const ENABLED = 'lcoy.bookmarks_enabled';

    public const TOPIC_BUTTON = 'lcoy.bookmarks_topic_button';

    public const USER_MENU = 'lcoy.bookmarks_user_menu';

    public static function enabled(): bool
    {
        /** @var SettingsRepositoryInterface $settings */
        $settings = resolve(SettingsRepositoryInterface::class);

        return (bool) $settings->get(self::ENABLED, true);
    }

    /**
     * @throws ModelNotFoundException
     */
    public static function assertEnabled(): void
    {
        if (! self::enabled()) {
            throw new ModelNotFoundException();
        }
    }
}
