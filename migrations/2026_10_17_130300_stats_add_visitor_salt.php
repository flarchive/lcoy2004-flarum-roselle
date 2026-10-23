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

/*
 * 用于标识浏览量的访客哈希的盐。没有它，一个 IPv4 的哈希
 * 几分钟内就会被暴力破解（IP 总共只有 40 亿个）；有了
 * 每个论坛随机的盐，数据表就不会暴露访问来自何处。
 * 在迁移中生成一次，永不发送到浏览器。
 */
return Migration::addSettings([
    'lcoy.stats_visitor_salt' => bin2hex(random_bytes(16)),
]);
