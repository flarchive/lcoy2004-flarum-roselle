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

namespace Lcoy\Roselle\Gaps\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Tags\Tag;
use Lcoy\Roselle\Gaps\GapsSettings;
use Lcoy\Roselle\Gaps\UnreadTags;

/**
 * 标签上的 `lcoyHasUnread`：侧边栏中分类的"有新内容"圆点。父标签会与
 * 子标签一同点亮，与 Discourse 一致。
 */
final class TagResourceFields
{
    public function __construct(
        private readonly UnreadTags $unread,
        private readonly GapsSettings $gaps,
    ) {
    }

    public function __invoke(): array
    {
        // 每个标签都会检查可见性：设置只读一次。
        $unreadOn = $this->gaps->on(GapsSettings::CATEGORY_UNREAD);

        return [
            Schema\Boolean::make('lcoyHasUnread')
                ->visible(fn (Tag $tag, Context $context) => ! $context->getActor()->isGuest() && $unreadOn)
                ->get(fn (Tag $tag, Context $context) => isset($this->unread->for($context->getActor())[(int) $tag->id])),
        ];
    }
}
