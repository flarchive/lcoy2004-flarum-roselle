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

use Illuminate\Console\Scheduling\Event;

/**
 * 每五分钟运行一次，且不重叠：一次缓慢的循环（一次处理大量提醒）不能
 * 与下一次循环重复发送相同的提醒。
 */
final class ReminderSchedule
{
    public function __invoke(Event $event): void
    {
        $event->everyFiveMinutes()->withoutOverlapping();
    }
}
