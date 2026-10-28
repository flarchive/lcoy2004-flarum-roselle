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

namespace Lcoy\Roselle\Community\Api;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\AboutPages;

/**
 * GET /api/lcoy-about-pages/{id}："关于"区域额外选项卡之一。只响应
 * 管理员列表中的页面，并遵循 fof/pages 的可见性；其他任何页面
 * （或未启用 fof/pages）都返回 404，以免该端点变成读取区域外页面的途径。
 */
final class ShowAboutPageController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AboutPages $pages,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        // Flarum 会把路由参数合并进 query 参数。
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $page = $this->pages->find($actor, $id);

        if ($page === null) {
            throw new RouteNotFoundException();
        }

        return new JsonResponse([
            'html' => $this->pages->html($page),
            'title' => (string) $page->title,
            'label' => $this->pages->label($page),
            'pageId' => (int) $page->id,
        ]);
    }
}
