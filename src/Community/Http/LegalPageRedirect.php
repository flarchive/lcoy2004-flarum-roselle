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

namespace Lcoy\Roselle\Community\Http;

use Flarum\Http\Exception\RouteNotFoundException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\LegalPages;

/**
 * /tos 和 /privacy，与 Discourse 的 `tos_url`/`privacy_policy_url` 类似：
 * 跳转到政策地址（来自 fof/terms 或主题的后台设置）。没有地址时页面
 * 不存在——返回 404，而不是空页面。
 */
final class LegalPageRedirect implements RequestHandlerInterface
{
    public function __construct(
        private readonly LegalPages $pages
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $url = $this->pages->url((string) Arr::get($request->getQueryParams(), 'page'));

        if ($url === null) {
            throw new RouteNotFoundException();
        }

        return new RedirectResponse($url, 302);
    }
}
