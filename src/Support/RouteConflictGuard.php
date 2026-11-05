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

use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Http\RouteCollection;
use Psr\Log\LoggerInterface;

/**
 * 主题中已被其他扩展占用的路由会被移除，而不是让论坛崩溃。
 *
 * FastRoute 不接受方法和路径都相同的两条路由（主题的 `GET /chat` 与聊天
 * 扩展的、主题的 `GET /search` 与搜索扩展的……）：整个论坛会在 boot 时因
 * BadRouteException 崩溃。这里在所有扩展都注册完自己的路由之后
 * （afterResolving 会在集合的所有 extend/resolving 之后运行），每个重复
 * 路径保留其他扩展的路由，移除主题的（名称 `lcoy.*`）——因此依赖该路由的
 * 主题功能在那个地址上直接不出现。
 */
final class RouteConflictGuard extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        foreach (['forum', 'api', 'admin'] as $frontend) {
            $this->container->afterResolving(
                "flarum.{$frontend}.routes",
                fn (RouteCollection $routes) => $this->dropDuplicates($routes, $frontend)
            );
        }
    }

    private function dropDuplicates(RouteCollection $routes, string $frontend): void
    {
        foreach (self::duplicatesToDrop($routes->getRoutes()) as $key => $drop) {
            foreach ($drop as $name) {
                $routes->removeRoute($name);
            }

            $this->logger()?->info("[lcoy] 路由 {$frontend} {$key} 已由其他扩展注册；主题的路由已被移除: ".implode(', ', $drop));
        }
    }

    /**
     * 对于每个重复的"方法 路径"，返回要移除的名称：当其他扩展有相同路由
     * 时，移除主题的（`lcoy*`）；若只是主题自身重复，则移除除第一个之外
     * 的全部。
     *
     * @param array<string, array{method: string, path: string}> $routes
     * @return array<string, list<string>>
     */
    public static function duplicatesToDrop(array $routes): array
    {
        $byPath = [];

        foreach ($routes as $name => $route) {
            $byPath[strtoupper((string) $route['method']).' '.$route['path']][] = (string) $name;
        }

        $result = [];

        foreach ($byPath as $key => $names) {
            if (count($names) < 2) {
                continue;
            }

            $ours = array_values(array_filter($names, static fn (string $name): bool => str_starts_with($name, 'lcoy')));
            $drop = count($ours) === count($names) ? array_slice($ours, 1) : $ours;

            if ($drop !== []) {
                $result[$key] = $drop;
            }
        }

        return $result;
    }

    private function logger(): ?LoggerInterface
    {
        return $this->container->bound(LoggerInterface::class) ? $this->container->make(LoggerInterface::class) : null;
    }
}
