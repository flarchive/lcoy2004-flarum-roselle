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

use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\GuidelinesPage;

/**
 * POST /api/lcoy-guidelines/page——仅管理员：在 fof/pages 中创建
 * "指南"页面，内容为主题当前的指南文本，并把它设为 /guidelines 的页面。
 * 此后内容直接在 fof/pages 中编辑。
 */
final class CreateGuidelinesPageController implements RequestHandlerInterface
{
    public function __construct(private readonly GuidelinesPage $pages)
    {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if (! $this->pages->available()) {
            throw new ValidationException(['fof-pages' => 'fof/pages is not enabled.']);
        }

        $page = $this->pages->create();

        return new JsonResponse(['pageId' => (int) $page->id, 'title' => (string) $page->title], 201);
    }
}
