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

use Closure;
use Flarum\Frontend\Document;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ServerRequestInterface;
use Lcoy\Roselle\Community\Community;

/**
 * 服务端的 /about、/u 和 /g 路由内容：选项卡标题（之后由 Mithril 维护）
 * 以及功能关闭时的 404——否则论坛会先打开页面，然后才发现它并不存在。
 */
final class CommunityPage
{
    public function __construct(
        private readonly Community $community,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /** 页面回调，采用 `Extend\Frontend::route()` 期望的格式。 */
    public static function for(string $settingKey, string $titleKey): Closure
    {
        return static function (Document $document, ServerRequestInterface $request) use ($settingKey, $titleKey): void {
            resolve(self::class)->render($document, $settingKey, $titleKey);
        };
    }

    public function render(Document $document, string $settingKey, string $titleKey): void
    {
        $this->community->assertEnabled($settingKey);

        $document->title = $this->translator->trans("lcoy-roselle.forum.community.$titleKey");
    }
}
