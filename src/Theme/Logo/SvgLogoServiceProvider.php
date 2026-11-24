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

namespace Lcoy\Roselle\Theme\Logo;

use Flarum\Api\Controller\UploadLogoController;
use Flarum\Foundation\AbstractServiceProvider;

/**
 * 核心的 POST /api/logo 路由通过容器解析控制器：在这里替换它，就能让
 * Flarum 默认的 logo 字段接受 SVG。
 */
final class SvgLogoServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(UploadLogoController::class, SvgLogoUploadController::class);
    }
}
