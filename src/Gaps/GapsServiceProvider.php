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

use Flarum\Foundation\AbstractServiceProvider;

/**
 * 每个请求一份会做计算的组件实例：有更新的标签会针对文档中的所有标签
 * 统一计算一次。
 */
final class GapsServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->singleton(UnreadTags::class);
    }
}
