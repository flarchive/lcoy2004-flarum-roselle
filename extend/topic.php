<?php

/*
 * This file is part of lcoy/roselle.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 * Copyright (c) 2026 lcoy
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * 主题页面：底部的 "标记为未读"（Discourse）。论坛会暴露
 * `lcoyMarkUnread`，以便 JS 仅在这个文件被加载时
 * 显示该按钮。
 */

use Flarum\Api\Context;
use Flarum\Api\Endpoint\Index;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Lcoy\Roselle\Topic\Api\DiscussionMarkUnreadField;
use Lcoy\Roselle\Topic\Api\DiscussionParticipantsField;

return [
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionMarkUnreadField::class)
        ->fields(DiscussionParticipantsField::class)
        // 列表中每行最多显示四位参与者的头像。
        // 该属性很精简（不把用户作为资源包含），整页只需两次查询，
        // 得益于下面的 prefetch。
        ->endpoint(Index::class, fn (Index $endpoint) => $endpoint
            ->beforeSerialization(static function (Context $context, array $results): void {
                resolve(DiscussionParticipantsField::class)->prefetch($results['models'] ?? []);
            })),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('lcoyMarkUnread')->get(fn () => true),
        ]),
];
