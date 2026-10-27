<?php

/*
 * This file is part of lcoy/roselle.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 * Copyright (c) 2026 lcoy
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Discourse 的编辑器（composer）：emoji 选择器、相似主题、
 * #分类/#标签、草稿、"作为关联主题回复" 以及并排预览。
 *
 * 全部是前端功能；这里只放管理员选项。草稿由 fof/drafts 保存
 * （`drafts` 表，API `/api/drafts`）。
 */

use Flarum\Extend;

// 主 extend.php 会在自身作用域内 `require` 这个文件：这里散落的变量
// （如 $settings）会覆盖它的。所以一切都在函数内部。
$composerSettings = (static function (): Extend\Settings {
    $settings = new Extend\Settings();

    // 键 => 论坛中的属性。全部默认开启：主题复刻了
    // Discourse，不想要其中某项的人可在管理员卡片中关闭。
    foreach ([
        'lcoy.composer_enabled' => 'lcoyComposerEnabled',
        'lcoy.composer_similar' => 'lcoyComposerSimilar',
        'lcoy.composer_hashtags' => 'lcoyComposerHashtags',
        // 仅在启用 fof/drafts 时有效（前端会检查该扩展）。
        'lcoy.composer_drafts' => 'lcoyComposerDrafts',
        'lcoy.composer_linked_topic' => 'lcoyComposerLinkedTopic',
        'lcoy.composer_preview' => 'lcoyComposerPreview',
    ] as $key => $attributeName) {
        $settings->default($key, true)->serializeToForum($attributeName, $key, 'boolval');
    }

    return $settings;
})();

return [
    $composerSettings,
];
