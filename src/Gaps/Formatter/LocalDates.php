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

namespace Lcoy\Roselle\Gaps\Formatter;

use s9e\TextFormatter\Configurator;

/**
 * Discourse 的本地日期（discourse-local-dates）：
 *
 *     [date=2026-10-20 time=14:00 timezone="America/Sao_Paulo"]
 *
 * 会变成一个 <span>，包含日期、时间和作者所在时区；论坛按阅读者的时区
 * 显示同一时间（"20 out 2026, 14:00"），并在标题中显示原始时间。
 * 没有 JavaScript 时，则保留所写的文本。
 *
 * 格式化器的配置从下一次"清除缓存"起生效；旧帖子保存的是当时的文本。
 */
final class LocalDates
{
    public function __invoke(Configurator $config): void
    {
        if (isset($config->tags['DATE'])) {
            return;
        }

        $config->BBCodes->addCustom(
            '[DATE={REGEXP1=/^\d{4}-\d{2}-\d{2}$/} time={REGEXP2=/^\d{1,2}:\d{2}(?::\d{2})?$/;optional} timezone={REGEXP3=/^[A-Za-z0-9_+\-\/]{1,64}$/;optional}]',
            '<span class="lcoy-local-date" data-date="{REGEXP1}" data-time="{REGEXP2}" data-timezone="{REGEXP3}">{REGEXP1}<xsl:if test="@time"> {REGEXP2}</xsl:if><xsl:if test="@timezone"> ({REGEXP3})</xsl:if></span>'
        );

        // 与 Discourse 一样，该标签没有闭合：写成 [date=…] 即可。
        $config->tags['DATE']->rules->autoClose();
    }
}
