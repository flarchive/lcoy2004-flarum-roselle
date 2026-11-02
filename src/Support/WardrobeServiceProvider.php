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

namespace Lcoy\Roselle\Support;

use Ernestdefoe\Wardrobe\ThemeAssets;
use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Foundation\Config;
use Flarum\Frontend\Compiler\JsCompiler;

/**
 * 轻量版 Wardrobe：访问时绝不编译的 ThemeAssets（见 LazyThemeAssets），
 * 以及生产环境不带 sourcemap 的 JS 编译器（见 LeanJsCompiler）。
 * 仅在启用 Wardrobe 时注册。
 */
final class WardrobeServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(ThemeAssets::class, LazyThemeAssets::class);

        if (! $this->container->make(Config::class)->inDebugMode()) {
            $this->container->bind(JsCompiler::class, LeanJsCompiler::class);
        }
    }
}
