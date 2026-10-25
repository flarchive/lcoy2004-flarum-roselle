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
 * 预加载：主题页面在启动后立刻会发出的请求，直接出现在首次加载的 HTML 中
 * （见 `src/Preload/PreloadContent.php`）。没有新表，也没有迁移。
 */

use Flarum\Extend;
use Lcoy\Roselle\Preload\PreBootShell;
use Lcoy\Roselle\Preload\PreloadContent;

return [
    // 低优先级：在路由内容之后运行，后者会把个人资料用户放进 `apiDocument`。
    (new Extend\Frontend('forum'))
        ->content(PreloadContent::class, -10)
        // 外壳（#app 的类、页眉挂载点）在首次绘制之前完成。
        ->content(PreBootShell::class),
];
