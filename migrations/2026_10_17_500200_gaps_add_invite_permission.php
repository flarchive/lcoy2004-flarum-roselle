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

use Flarum\Database\Migration;
use Flarum\Group\Group;

/*
 * 谁可以生成邀请链接：默认是普通成员（管理员可在
 * 权限中修改）。Discourse 从信任等级 2 开始开放；这里的
 * 按群组设置的权限是 Flarum 的等价做法。
 */
return Migration::addPermissions([
    'lcoy.createInvite' => Group::MEMBER_ID,
]);
