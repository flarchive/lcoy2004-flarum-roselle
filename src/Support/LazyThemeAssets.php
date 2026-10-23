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
use Ernestdefoe\Wardrobe\ThemeRegistry;
use Ernestdefoe\Wardrobe\WarmThemeAssets;
use Flarum\Frontend\Compiler\RevisionCompiler;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Queue\SyncQueue;

/**
 * 访问时无负担的 Wardrobe。
 *
 * 原版会在打开论坛的请求中重新编译主题（只要资产有任何变化），并在重新
 * 编译时一次性预热所有主题。在小服务器上这会耗尽内存（500 错误），并让
 * 首次访问变慢。这里的做法：
 *
 * - 访问时，已有文件的主题按现状提供，即使略有陈旧，重新编译交给队列
 *   （worker）；
 * - 尚无文件的主题暂时使用核心的 CSS/JS，直到 worker 编译完成；
 * - 在 worker（CLI）中且没有真实队列时，沿用原版行为。
 */
final class LazyThemeAssets extends ThemeAssets
{
    public function __construct(
        private readonly Container $app,
        ThemeRegistry $themes,
        SettingsRepositoryInterface $config,
        private readonly Cache $store
    ) {
        parent::__construct($app, $themes, $config, $store);
    }

    #[\Override]
    public function cssUrlFor(string $themeId): ?string
    {
        return $this->inVisit() ? $this->servedUrl($themeId, 'css') : parent::cssUrlFor($themeId);
    }

    #[\Override]
    public function jsUrlFor(string $themeId): ?string
    {
        return $this->inVisit() ? $this->servedUrl($themeId, 'js') : parent::jsUrlFor($themeId);
    }

    /** 存在真实队列 worker 的访问：此时访问过程绝不编译。 */
    private function inVisit(): bool
    {
        return PHP_SAPI !== 'cli' && ! $this->queue() instanceof SyncQueue;
    }

    /**
     * 已编译文件的 URL，且不触发任何编译。陈旧时：仍然照此提供，并请求
     * 队列更新它。尚无文件时：返回 null（页面暂时使用核心的 forum.css/js），
     * 并请求队列编译它；在那里编译会耗尽 PHP 内存（500 错误）。
     */
    private function servedUrl(string $themeId, string $type): ?string
    {
        // Wardrobe 和编译器的成员是受保护的：需要在其作用域内读取。
        $peek = \Closure::bind(function (string $themeId, string $type): ?array {
            $compilers = $this->compilersFor($themeId);

            return $compilers === null ? null : [$compilers[$type], $this->isStale($themeId)];
        }, $this, ThemeAssets::class);

        [$compiler, $stale] = $peek($themeId, $type) ?? [null, false];

        if ($compiler === null) {
            return null;
        }

        $hasRevision = \Closure::bind(fn (): bool => (bool) $this->versioner->getRevision($this->filename), $compiler, RevisionCompiler::class);

        if (! $hasRevision()) {
            $this->requestWarm();

            return null;
        }

        if ($stale) {
            $this->requestWarm();
        }

        return $compiler->getUrl();
    }

    /** 每分钟最多排队一次重新编译，无论有多少访问到来。 */
    private function requestWarm(): void
    {
        if ($this->store->add('lcoy.wardrobe.warm_requested', 1, 60)) {
            $this->queue()->push(new WarmThemeAssets());
        }
    }

    private function queue(): Queue
    {
        return $this->app->make(Queue::class);
    }

    /**
     * 队列 worker 是长生命周期进程：Wardrobe 的"本次请求已更新"列表
     * （`fresh`）在其中会被永久填满，后续预热便不再重新编译任何内容
     * （所服务的主题会一直陈旧，直到有人手动执行预热）。每次预热都从
     * 空列表开始，并依据时间戳判断，如同新的请求。
     */
    #[\Override]
    public function warmAll(): void
    {
        \Closure::bind(function (): void {
            $this->fresh = [];
        }, $this, ThemeAssets::class)();

        parent::warmAll();
    }
}
