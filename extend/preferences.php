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
 * 偏好设置标签页（`/u/{username}/preferences/{tab}`），与
 * Discourse 相同。只有文档路由：内容由核心的 SettingsPage 提供，
 * 在 JS 中拆分为标签。不带标签的 `/u/{username}/preferences` 已由
 * 核心的个人资料路由处理（`/u/{username}[/{filter}]`）。
 */

use Flarum\Extend;
use Flarum\Forum\Content\AssertRegistered;

return [
    (new Extend\Frontend('forum'))
        // 与核心的 `/settings` 相同：访客会被引导到登录页。
        ->route('/u/{username}/preferences/{tab:[a-z-]+}', 'lcoy.user.preferences.tab', AssertRegistered::class),
];
