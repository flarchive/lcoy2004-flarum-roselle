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

namespace Lcoy\Roselle\Bookmarks\Console;

use Carbon\Carbon;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Post;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Lcoy\Roselle\Bookmarks\Bookmark;
use Lcoy\Roselle\Bookmarks\BookmarksFeature;
use Lcoy\Roselle\Bookmarks\Notification\BookmarkReminderBlueprint;

/**
 * 发送已到期的书签提醒（`php flarum lcoy:bookmarks:remind`）。
 *
 * 由 Flarum 的调度器自动运行（在 cron 中执行 `php flarum schedule:run`），
 * 每五分钟一次——与 Discourse 的作业间隔相同。
 */
final class SendBookmarkReminders extends Command
{
    /** @var string */
    protected $signature = 'lcoy:bookmarks:remind';

    /** @var string */
    protected $description = '发送已到期的书签提醒通知。';

    private const CHUNK = 100;

    public function handle(NotificationSyncer $notifications): int
    {
        if (! BookmarksFeature::enabled()) {
            $this->info('书签功能已关闭，无需发送。');

            return self::SUCCESS;
        }

        $sent = 0;
        $now = Carbon::now();

        Bookmark::query()
            ->whereNotNull('reminder_at')
            ->whereNull('reminded_at')
            ->where('reminder_at', '<=', $now)
            ->with(['user', 'post'])
            ->chunkById(self::CHUNK, function (Collection $bookmarks) use ($notifications, $now, &$sent) {
                /** @var Bookmark $bookmark */
                foreach ($bookmarks as $bookmark) {
                    // 在发送之前就标记为已发送：某个提醒发送出错，
                    // 不能让下一个循环永远重复它（用户仍会在列表中看到该书签）。
                    $bookmark->reminded_at = $now;
                    $bookmark->save();

                    $user = $bookmark->user;

                    // 该帖子可能对用户已不可见（被隐藏，或主题被移入受限分类）：
                    // 不为不可见的内容发送提醒。
                    $post = $user ? Post::whereVisibleTo($user)->find($bookmark->post_id) : null;

                    if (! $user || ! $post) {
                        continue;
                    }

                    $notifications->sync(new BookmarkReminderBlueprint($bookmark, $post), [$user]);
                    $sent++;
                }
            });

        $this->info("已发送提醒：{$sent}。");

        return self::SUCCESS;
    }
}
