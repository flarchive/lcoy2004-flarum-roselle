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
 * A cada cinco minutos, sem sobrepor: um ciclo lento (muitos lembretes de uma
 * vez) não pode começar a enviar os mesmos lembretes que o próximo.
 */
final class ReminderSchedule
{
    public function __invoke(Event $event): void
    {
        $event->everyFiveMinutes()->withoutOverlapping();
    }
}
