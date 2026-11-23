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
 * Discourse 的登录与注册页面（/login 和 /signup）：整页表单，而不是弹窗。
 * 只输出论坛文档，不含预加载内容 —— JS 借助核心弹窗的逻辑来渲染页面
 * （校验、扩展字段、社交登录）。
 *
 * 核心只有 POST /login 和 POST /register：GET /login、/signup 和
 * /forgot-password 都是空的。GET /reset/{token}（核心的独立页面）会变成
 * 论坛页面，路由名同为 `resetPassword`，重置邮件正是用它来拼接链接；
 * POST /reset 仍由核心提供。不要留下散落的变量：extend.php 会 `require`
 * 这个文件。
 */

use Flarum\Extend;
use Lcoy\Roselle\Auth\ResetPasswordContent;

return [
    // 只有在这个文件被加载时，页眉才会链接到这些页面
    // （否则在 /login 上按 F5 会 404）：这个属性就是证据。
    (new Extend\Settings())
        ->default('lcoy.auth_routes_backend', true)
        ->serializeToForum('lcoyAuthRoutes', 'lcoy.auth_routes_backend', fn () => true),

    (new Extend\Frontend('forum'))
        ->route('/login', 'lcoy.login')
        ->route('/signup', 'lcoy.signup')
        ->route('/forgot-password', 'lcoy.forgot')
        ->removeRoute('resetPassword')
        ->route('/reset/{token}', 'resetPassword', ResetPasswordContent::class),
];
