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

namespace Lcoy\Roselle\Gaps\NotFound;

use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Illuminate\Support\Collection;
use Lcoy\Roselle\Gaps\GapsSettings;

/**
 * Discourse 的 404 页面数据（"糟糕！该页面不存在或为私密。"）：
 * logo、颜色、热门主题和最新主题。
 *
 * 错误页面在没有请求上下文的情况下渲染（核心的 ViewFormatter 不会
 * 传递它），因此这里取的是访客能看到的主题——这也避免在错误页面上
 * 显示受限内容。
 *
 * 这里的任何失败都会退回核心页面：错误页面本身不能再出错。
 */
final class NotFoundPage
{
    private const COUNT = 5;

    public function __construct(
        private readonly GapsSettings $gaps,
        private readonly SettingsRepositoryInterface $settings,
        private readonly UrlGenerator $url,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function enabled(): bool
    {
        return $this->gaps->on(GapsSettings::NOT_FOUND);
    }

    /** @return array<string, mixed>|null */
    public function data(): ?array
    {
        try {
            $base = rtrim($this->url->to('forum')->base(), '/');
            $logo = $this->settings->get('logo_path');

            return [
                'base' => $base,
                'title' => (string) $this->settings->get('forum_title'),
                'logo' => $logo ? $base.'/assets/'.$logo : null,
                'color' => (string) $this->settings->get('theme_primary_color', '#4d698e'),
                'popular' => $this->topics('popular'),
                'recent' => $this->topics('recent'),
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return list<array{title: string, url: string, tag: ?string, color: ?string}> */
    private function topics(string $kind): array
    {
        $query = Discussion::query()
            ->whereVisibleTo(new Guest())
            ->where('is_private', false)
            ->whereNull('hidden_at');

        $kind === 'popular'
            ? $query->orderByDesc('comment_count')->orderByDesc('last_posted_at')
            : $query->orderByDesc('created_at');

        /** @var Collection<int, Discussion> $discussions */
        $discussions = $query->limit(self::COUNT)->get();
        $tags = $this->extensions->isEnabled('flarum-tags');

        return $discussions->map(function (Discussion $discussion) use ($tags) {
            $tag = $tags ? $discussion->tags()->whereNull('parent_id')->whereNotNull('position')->first() : null;

            return [
                'title' => (string) $discussion->title,
                'url' => $this->url->to('forum')->route('discussion', ['id' => $discussion->id.'-'.$discussion->slug]),
                'tag' => $tag?->name,
                'color' => $tag?->color ?: null,
            ];
        })->values()->all();
    }
}
