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

namespace Lcoy\Roselle\Extras;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * "扩展"功能的设置键（高级搜索、批量选择、按时间段查看最佳、字号以及
 * 打印）。
 *
 * 集中放在一处，是因为 extender、控制器和监听器必须对每个键名保持一致——
 * 其中一方拼错键名不会报错，只会让功能无故开启或关闭。
 */
final class Extras
{
    public const SEARCH_PAGE = 'lcoy.search_page_enabled';

    public const BULK_SELECT = 'lcoy.bulk_select_enabled';

    public const TOP_PERIODS = 'lcoy.top_periods_enabled';

    public const TEXT_SIZE = 'lcoy.text_size_enabled';

    public const PRINT_TOPIC = 'lcoy.print_topic_enabled';

    /**
     * 仓库返回字符串（"1"、"0"）或 extender 的布尔默认值；
     * 两种格式必须给出相同的答案。
     */
    public static function enabled(SettingsRepositoryInterface $settings, string $key): bool
    {
        return (bool) filter_var($settings->get($key), FILTER_VALIDATE_BOOLEAN);
    }
}
