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

namespace Lcoy\Roselle\Gaps;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * 补齐后端缺失功能（gaps）的开关设置键，已转换为布尔值。每个入口
 * （路由、监听器、API 字段）都查询自己的键：关闭后，该功能会从论坛中
 * 消失，路由返回 404。
 */
final class GapsSettings
{
    public const POST_EDITED = 'lcoy.notify_post_edited';

    public const TOPIC_LINKED = 'lcoy.notify_topic_linked';

    public const TAG_TRACKING = 'lcoy.tag_tracking_enabled';

    public const IGNORE_USERS = 'lcoy.ignore_users_enabled';

    public const MOVE_POSTS = 'lcoy.move_posts_enabled';

    public const NOT_FOUND = 'lcoy.not_found_page';

    public const MARKDOWN_TABLES = 'lcoy.markdown_tables';

    public const LOCAL_DATES = 'lcoy.local_dates';

    public const CATEGORY_UNREAD = 'lcoy.sidebar_category_dots';

    /** 默认值：全部开启，与 Discourse 出厂状态一致。 */
    public const DEFAULTS = [
        self::POST_EDITED => true,
        self::TOPIC_LINKED => true,
        self::TAG_TRACKING => true,
        self::IGNORE_USERS => true,
        self::MOVE_POSTS => true,
        self::NOT_FOUND => true,
        self::MARKDOWN_TABLES => true,
        self::LOCAL_DATES => true,
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public function on(string $key): bool
    {
        $value = $this->settings->get($key, self::DEFAULTS[$key] ?? false);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }
}
