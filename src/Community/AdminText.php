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

namespace Lcoy\Roselle\Community;

use Flarum\Formatter\Formatter;
use Illuminate\Contracts\Cache\Repository as Cache;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

/**
 * 管理员为社区页面（"关于"、指南）撰写的长文本，输出为 HTML。含 HTML 标签时，
 * 文本按原样输出——管理员本就掌控论坛的 HTML（核心的欢迎消息也是如此）。
 * 不含标签时，则交给帖子格式化器处理，以便支持论坛启用的 Markdown 和
 * BBCode；结果按内容缓存，因此修改文本后下次打开即生效。
 */
final class AdminText
{
    public const CACHE_TTL = 1800;

    public function __construct(
        private readonly Formatter $formatter,
        private readonly Cache $cache,
    ) {
    }

    public function render(string $text, ServerRequestInterface $request): ?string
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        if (preg_match('/<[a-z][^>]*>/i', $text) === 1) {
            return $text;
        }

        return $this->cache->remember('lcoy.about.text.'.md5($text), self::CACHE_TTL, function () use ($text, $request) {
            try {
                return $this->formatter->render($this->formatter->parse($text), null, $request);
            } catch (Throwable) {
                // 格式化器插件出错不应让页面崩溃。
                return '<p>'.nl2br(htmlspecialchars($text, ENT_QUOTES)).'</p>';
            }
        });
    }
}
