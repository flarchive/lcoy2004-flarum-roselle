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

namespace Lcoy\Roselle\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Illuminate\Database\ConnectionInterface;

/**
 * Flarum 未保存的主题地图数字：主题获得了多少点赞。
 *
 * 参与者数量使用核心的 `participantCount`（列
 * `discussions.participant_count`，由 DiscussionMetadataUpdater 更新）：
 * 这里无需重新计算。
 *
 * 仅在主题页（`showing`）中提供：在列表中会变成每行一次查询，
 * 而列表并不显示这个数字。
 */
final class TopicMapFields
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    public function __invoke(): array
    {
        $showing = static fn (Discussion $discussion, Context $context): bool => $context->showing(DiscussionResource::class);

        return [
            Schema\Integer::make('lcoyLikeCount')
                ->visible(fn (Discussion $discussion, Context $context): bool => $showing($discussion, $context) && $this->extensions->isEnabled('flarum-likes'))
                ->get(fn (Discussion $discussion): int => (int) $this->visibleComments($discussion)
                    ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
                    ->count()),
        ];
    }

    /** 主题的任何阅读者都能看到的评论：地图对所有人一致。 */
    private function visibleComments(Discussion $discussion)
    {
        return $this->db->table('posts')
            ->where('posts.discussion_id', $discussion->id)
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->where('posts.is_private', false);
    }
}
