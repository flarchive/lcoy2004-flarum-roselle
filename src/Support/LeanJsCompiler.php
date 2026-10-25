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

use Flarum\Frontend\Compiler\JsCompiler;

/**
 * 生产环境（调试关闭）下不带 sourcemap 的核心 JS 编译器。
 *
 * 生成 sourcemap 是编译 bundle 中开销最大的部分：核心会把每个扩展的
 * `.map`（数 MB）读入内存并合并。使用 Wardrobe 时，每个主题都会重复这一
 * 过程，在 1 GB 的服务器上编译会耗尽内存（500 错误）。没有映射时，
 * 编译只是拼接文件。
 */
class LeanJsCompiler extends JsCompiler
{
    #[\Override]
    protected function renderOutput(array $sources): ?string
    {
        if ($sources === []) {
            return null;
        }

        $output = [];

        foreach ($sources as $source) {
            $output[] = $this->format($source->getContent());
        }

        return implode("\n", $output);
    }
}
