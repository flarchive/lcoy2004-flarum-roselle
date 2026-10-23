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

namespace Lcoy\Roselle\ListRoutes;

use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\RedirectResponse;
use Override;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 把 Discourse 的分类链接（/c/suporte/6、/c/suporte/instalacao/31、
 * /c/suporte/6/l/top）重定向到 Flarum 中对应的标签页（/t/instalacao）。
 *
 * slug 取最后一个既不是数字、也不属于列表后缀（`l/<排序>`、`none`、
 * `all`）的片段。URL 是手工拼接的，而不是使用 flarum/tags 的 `tag` 路由，
 * 以免依赖该扩展是否启用。
 */
final class RedirectCategory implements RequestHandlerInterface
{
    private const IGNORED = ['none', 'all', 'l'];

    public function __construct(
        private readonly UrlGenerator $url,
    ) {
    }

    #[Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $path = (string) ($request->getAttribute('routeParameters')['path'] ?? '');
        $segments = array_values(array_filter(explode('/', $path), static fn (string $part): bool => $part !== ''));

        // "/l/" 之后的内容是列表排序，而不是分类。
        $listAt = array_search('l', $segments, true);
        if ($listAt !== false) {
            $segments = array_slice($segments, 0, (int) $listAt);
        }

        $slug = null;
        foreach (array_reverse($segments) as $segment) {
            if (preg_match('/^\d+$/', $segment) !== 1 && ! in_array($segment, self::IGNORED, true)) {
                $slug = $segment;
                break;
            }
        }

        $base = rtrim($this->url->to('forum')->base(), '/');
        $target = $slug === null ? $base.'/categories' : $base.'/t/'.rawurlencode(rawurldecode($slug));

        return new RedirectResponse($target, 301);
    }
}
