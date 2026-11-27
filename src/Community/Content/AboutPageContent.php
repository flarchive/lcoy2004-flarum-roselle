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

namespace Lcoy\Roselle\Community\Content;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Psr\Http\Message\ServerRequestInterface;
use Lcoy\Roselle\Community\AboutPages;

/**
 * 服务端的 /about/{id-slug} 路由：选项卡标题取自页面，而管理员列表之外
 * 的页面（或对请求者不可见的页面）在文档层就返回 404，与其他社区页面
 * 一致。
 */
final class AboutPageContent
{
    public function __construct(
        private readonly AboutPages $pages,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $id = AboutPages::idFromParam((string) ($request->getQueryParams()['page'] ?? ''));
        $page = $this->pages->find(RequestUtil::getActor($request), $id);

        if ($page === null) {
            throw new RouteNotFoundException();
        }

        $document->title = (string) $page->title;
    }
}
