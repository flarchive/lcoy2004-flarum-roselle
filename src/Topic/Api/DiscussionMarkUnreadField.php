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

namespace Lcoy\Roselle\Topic\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;

/**
 * 主题页脚中的"标记为未读"（Discourse）：`lcoyMarkUnread` 是开始被视为
 * 已读的最后一条帖子的序号。
 *
 * 核心的 `lastReadPostNumber` 只能向前推进（UserState::read 会忽略更小的
 * 数字），因此这里使用一个仅可写的自有字段，直接写入操作者的阅读状态——
 * 且只允许向后。
 */
final class DiscussionMarkUnreadField
{
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('lcoyMarkUnread')
                ->visible(false)
                ->writable(fn (Discussion $discussion, Context $context) => $context->updating() && ! $context->getActor()->isGuest())
                ->set(function (Discussion $discussion, int $value, Context $context): void {
                    $actor = $context->getActor();

                    $discussion->afterSave(function (Discussion $discussion) use ($actor, $value): void {
                        $state = $discussion->stateFor($actor);
                        $number = max(0, $value);

                        // 只允许回退：推进阅读进度是核心的职责。
                        if ($state->exists && $number < (int) $state->last_read_post_number) {
                            $state->last_read_post_number = $number;
                            $state->save();
                        }
                    });
                }),
        ];
    }
}
