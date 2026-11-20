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

namespace Lcoy\Roselle\Extras\Search;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;
use Lcoy\Roselle\Extras\Extras;

/**
 * 服务端的 `/search` 路由。页面本身由 JS 渲染；这里只确保直接打开（或
 * 刷新）该地址不会触发 Flarum 的 404——同时在后台关闭该功能时确实返回
 * 404。
 *
 * 结果不会预加载：搜索依赖浏览器端构建的过滤器，在服务端重复执行只会
 * 拖慢首次绘制。
 */
final class SearchPageContent
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): Document
    {
        if (! Extras::enabled($this->settings, Extras::SEARCH_PAGE)) {
            throw new RouteNotFoundException();
        }

        $query = trim((string) ($request->getQueryParams()['q'] ?? ''));

        $document->title = $query !== ''
            ? $this->translator->trans('lcoy-roselle.forum.extras.search.meta_title_query', ['query' => $query])
            : $this->translator->trans('lcoy-roselle.forum.extras.search.meta_title');

        // 搜索结果页面不应进入搜索引擎索引。
        $document->meta['robots'] = 'noindex';

        return $document;
    }
}
