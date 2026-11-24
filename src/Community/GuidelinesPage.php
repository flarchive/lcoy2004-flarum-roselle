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

use Flarum\Extension\ExtensionManager;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use FoF\Pages\Page;
use FoF\Pages\Util\Html;

/**
 * 把"指南"作为 fof/pages 页面：是哪一页（设置项 `lcoy.guidelines_page`）、
 * 其内容，以及用当前文本创建该页面。未启用 fof/pages 时，这里的任何
 * 功能都不会运行。
 */
final class GuidelinesPage
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function available(): bool
    {
        return $this->extensions->isEnabled('fof-pages') && class_exists(Page::class);
    }

    /** 选定的页面，前提是它存在且操作者可以查看。 */
    public function find(User $actor): ?Page
    {
        $id = (int) $this->settings->get(Community::GUIDELINES_PAGE);

        if ($id <= 0 || ! $this->available()) {
            return null;
        }

        $page = Page::query()->whereVisibleTo($actor)->find($id);

        return $page instanceof Page ? $page : null;
    }

    public function html(Page $page): string
    {
        return Html::render($page->content_html, $page);
    }

    /**
     * 在 fof/pages 中创建"指南"页面，内容为主题当前的指南文本（管理员设置
     * 的或默认的），并将其设为选定页面。
     */
    public function create(): Page
    {
        $custom = trim((string) $this->settings->get(Community::GUIDELINES_TEXT));

        $page = new Page();
        $page->title = $this->translator->trans('lcoy-roselle.forum.community.guidelines.title');
        $page->slug = 'guidelines';
        $page->content = $custom !== '' ? $custom : $this->defaultMarkdown();
        $page->is_hidden = false;
        $page->is_restricted = false;
        $page->is_html = false;
        $page->save();

        $this->settings->set(Community::GUIDELINES_PAGE, (string) $page->id);

        return $page;
    }

    /** 主题的默认文本，使用论坛的语言。 */
    public function defaultMarkdown(): string
    {
        $locale = strtolower($this->translator->getLocale());
        $file = str_starts_with($locale, 'zh') ? 'zh-Hans' : 'en';

        return (string) @file_get_contents(__DIR__.'/Content/guidelines/'.$file.'.md');
    }
}
