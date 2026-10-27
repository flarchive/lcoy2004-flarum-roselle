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
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use FoF\Pages\Page;
use FoF\Pages\Util\Html;

/**
 * 管理员设为"关于"区域额外选项卡的 fof/pages 页面（设置项
 * `lcoy.about_pages`，是按选项卡顺序排列的 `{id, label, icon}` JSON 列表）。
 * 只有列表中的页面才能通过主题的路由打开，并且始终遵循 fof/pages 自身的
 * 可见性规则。未启用 fof/pages 时，列表为空。
 */
final class AboutPages
{
    /** 再多就放不下作为选项卡了，同时也让设置项的 JSON 保持精简。 */
    public const MAX = 20;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function available(): bool
    {
        return $this->extensions->isEnabled('fof-pages') && class_exists(Page::class);
    }

    /**
     * 管理员配置的列表，已清理（整数且唯一的 id，最多 MAX 个）。
     *
     * @return list<array{id: int, label: string, icon: string}>
     */
    public function entries(): array
    {
        return self::parse($this->settings->get(Community::ABOUT_PAGES));
    }

    /**
     * 操作者能看到的选项卡，按管理员的顺序：只包含存在且 fof/pages
     * 允许其查看的页面。由于会进入论坛的 payload，因此只包含绘制选项卡
     * 和拼接 URL 所需的内容。
     *
     * @return list<array{id: int, label: string, slug: string, icon: string}>
     */
    public function forForum(User $actor): array
    {
        $entries = $this->entries();

        if ($entries === [] || ! $this->available()) {
            return [];
        }

        $pages = Page::query()
            ->whereVisibleTo($actor)
            ->whereIn('id', array_column($entries, 'id'))
            ->get(['id', 'title', 'slug'])
            ->keyBy('id');

        $tabs = [];

        foreach ($entries as $entry) {
            $page = $pages->get($entry['id']);

            if (! $page instanceof Page) {
                continue;
            }

            $tabs[] = [
                'id' => $entry['id'],
                'label' => $entry['label'] !== '' ? $entry['label'] : (string) $page->title,
                'slug' => self::slug((string) $page->slug),
                'icon' => $entry['icon'],
            ];
        }

        return $tabs;
    }

    /** 若页面在管理员列表中且操作者可以查看，则返回该页面。 */
    public function find(User $actor, int $id): ?Page
    {
        if ($id <= 0 || ! $this->available() || ! in_array($id, array_column($this->entries(), 'id'), true)) {
            return null;
        }

        $page = Page::query()->whereVisibleTo($actor)->find($id);

        return $page instanceof Page ? $page : null;
    }

    /** 选项卡的标签（管理员的标签或页面标题）。 */
    public function label(Page $page): string
    {
        foreach ($this->entries() as $entry) {
            if ($entry['id'] === (int) $page->id && $entry['label'] !== '') {
                return $entry['label'];
            }
        }

        return (string) $page->title;
    }

    public function html(Page $page): string
    {
        return Html::render($page->content_html, $page);
    }

    /**
     * 路由参数开头的 id（`3-regras` → 3），与核心的 `/d/{id}` 相同：
     * slug 只是装饰，可以变更而不会破坏链接。
     */
    public static function idFromParam(string $param): int
    {
        return preg_match('/^(\d+)/', $param, $match) ? (int) $match[1] : 0;
    }

    /**
     * 以正确格式保存设置项的值。任何不是"正整数 id 对象列表"的内容都会被
     * 丢弃：管理员提交 JSON，但设置 API 接受任意文本。
     */
    public static function normalize(mixed $raw): string
    {
        return (string) json_encode(self::parse($raw), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** @return list<array{id: int, label: string, icon: string}> */
    private static function parse(mixed $raw): array
    {
        $items = is_string($raw) ? json_decode($raw, true) : $raw;

        if (! is_array($items)) {
            return [];
        }

        $out = [];
        $seen = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $id = filter_var($item['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

            if ($id === false || isset($seen[$id])) {
                continue;
            }

            $seen[$id] = true;
            $label = is_string($item['label'] ?? null) ? trim(strip_tags($item['label'])) : '';
            $icon = is_string($item['icon'] ?? null) ? trim($item['icon']) : '';

            $out[] = [
                'id' => $id,
                'label' => mb_substr($label, 0, 60),
                // 只接受 Font Awesome 的类名（"fas fa-scale-balanced"）：图标会变成
                // `class` 属性，因此只允许字母、数字和连字符。
                'icon' => preg_match('/^[a-z0-9 -]{1,60}$/i', $icon) ? $icon : '',
            ];

            if (count($out) >= self::MAX) {
                break;
            }
        }

        return $out;
    }

    /** 用于 URL 的安全 slug（fof/pages 提供的 slug 可能为空或含空格）。 */
    private static function slug(string $slug): string
    {
        return trim((string) preg_replace('/[^\pL\pN_-]+/u', '-', $slug), '-');
    }
}
