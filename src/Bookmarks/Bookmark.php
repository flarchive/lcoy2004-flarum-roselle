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

namespace Lcoy\Roselle\Bookmarks;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Lcoy\Roselle\Bookmarks\Api\BookmarkBuffer;

/**
 * 一个被用户标记的帖子。
 *
 * @property int $id
 * @property int $user_id
 * @property int $post_id
 * @property string|null $name
 * @property Carbon|null $reminder_at
 * @property Carbon|null $reminded_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User|null $user
 * @property-read Post|null $post
 */
class Bookmark extends AbstractModel
{
    use ScopeVisibilityTrait;

    public const NAME_MAX_LENGTH = 100;

    protected $table = 'lcoy_bookmarks';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'post_id' => 'integer',
        'reminder_at' => 'datetime',
        'reminded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        // 帖子上的 `bookmark*` 属性来自按请求的缓冲区。
        // 在该请求中途创建或删除书签（POST 的响应包含该帖子）时，
        // 不能返回之前的状态。
        $forget = static fn (self $bookmark) => BookmarkBuffer::forget($bookmark->user_id, $bookmark->post_id);

        static::saved($forget);
        static::deleted($forget);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Post, $this>
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * 更换提醒时间。新的时间会重新生效：之前那次发送的记录
     * （`reminded_at`）会被清除，否则命令永远不会再发送它。
     */
    public function setReminder(?\DateTimeInterface $at): void
    {
        $next = $at === null ? null : Carbon::instance($at)->utc()->startOfMinute();
        $current = $this->reminder_at;

        // 相同的时间（前端会重发已有的时间）不算新的提醒：
        // 已经发送过的提醒不应再次触发。
        if ($next === null ? $current === null : ($current !== null && $next->equalTo($current))) {
            return;
        }

        $this->reminder_at = $next;
        $this->reminded_at = null;
    }

    public function setName(?string $name): void
    {
        $name = trim((string) $name);

        $this->name = $name === '' ? null : mb_substr($name, 0, self::NAME_MAX_LENGTH);
    }
}
