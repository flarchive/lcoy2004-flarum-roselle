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

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\AdminText;
use Lcoy\Roselle\Community\Community;
use Lcoy\Roselle\Community\GuidelinesPage;

/**
 * GET /api/lcoy-guidelines——"指南"（Discourse 的 /guidelines 与 /faq）。
 * 若启用了 fof/pages 且管理员选择了页面，则返回该页面的内容（遵循
 * fof/pages 自身的可见性）；否则返回管理员的文本，或主题在论坛语言下的
 * 默认内容。
 */
final class ShowGuidelinesController implements RequestHandlerInterface
{
    public function __construct(
        private readonly Community $community,
        private readonly SettingsRepositoryInterface $settings,
        private readonly AdminText $text,
        private readonly GuidelinesPage $pages,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::GUIDELINES_ENABLED);

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        if ($page = $this->fofPage($actor)) {
            return new JsonResponse($page);
        }

        $custom = trim((string) $this->settings->get(Community::GUIDELINES_TEXT));

        return new JsonResponse([
            'html' => $this->text->render($custom !== '' ? $custom : $this->pages->defaultMarkdown(), $request),
            'custom' => $custom !== '',
        ]);
    }

    /**
     * 选定的 fof/pages 页面，前提是扩展已启用、页面存在且操作者可以查看；
     * 否则返回 null，退回主题文本。
     *
     * @return array{html: string, custom: true, title: string, pageId: int}|null
     */
    private function fofPage(User $actor): ?array
    {
        $page = $this->pages->find($actor);

        if ($page === null) {
            return null;
        }

        return [
            'html' => $this->pages->html($page),
            'custom' => true,
            'title' => (string) $page->title,
            'pageId' => (int) $page->id,
        ];
    }
}
