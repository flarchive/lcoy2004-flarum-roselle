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
 * Discourse 个人资料摘要中依赖数据库中账号数据的部分：
 * "被回复最多"、"被谁点赞最多"、"获赞最多" 和 "最佳分类"。
 * 只读：没有新表，也没有迁移。
 */

use Flarum\Extend;
use Lcoy\Roselle\UserSummary\ShowUserSummaryController;

return [
    (new Extend\Routes('api'))
        ->get('/lcoy-user-summary/{id:\d+}', 'lcoy.user_summary', ShowUserSummaryController::class),
];
