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

namespace Lcoy\Roselle\Theme\Loader;

use Flarum\Frontend\Document;

/**
 * 现成的 SVG 会放入后台 payload，用于卡片中的样式预览：这样它们只有
 * 一个来源（LoaderPresets），JS 中无需复制。在论坛中它们不会进入 payload；
 * 那里所选用的 SVG 已在 CSS 中。
 */
final class LoaderAdminPayload
{
    public function __invoke(Document $document): void
    {
        $document->payload['lcoyLoaderPresets'] = LoaderPresets::SVG;
    }
}
