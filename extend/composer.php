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
 * Editor (composer) do Discourse: seletor de emoji, tópicos semelhantes,
 * #categoria/#etiqueta, rascunhos, "responder como tópico vinculado" e a
 * pré-visualização lado a lado.
 *
 * Tudo é front-end; aqui ficam só as opções do admin. Os rascunhos são
 * guardados pelo fof/drafts (tabela `drafts`, API `/api/drafts`).
 */

use Flarum\Extend;

// O extend.php principal faz `require` deste arquivo no próprio escopo: uma
// variável solta aqui (como $settings) sobrescreveria a dele. Por isso tudo
// fica dentro de uma função.
$composerSettings = (static function (): Extend\Settings {
    $settings = new Extend\Settings();

    // chave => atributo no fórum. Todas ligadas por padrão: o tema reproduz o
    // Discourse, e quem não quiser uma delas desliga no card do admin.
    foreach ([
        'canela.composer_enabled' => 'canelaComposerEnabled',
        'canela.composer_similar' => 'canelaComposerSimilar',
        'canela.composer_hashtags' => 'canelaComposerHashtags',
        // Só vale com o fof/drafts habilitado (o front confere a extensão).
        'canela.composer_drafts' => 'canelaComposerDrafts',
        'canela.composer_linked_topic' => 'canelaComposerLinkedTopic',
        'canela.composer_preview' => 'canelaComposerPreview',
    ] as $key => $attributeName) {
        $settings->default($key, true)->serializeToForum($attributeName, $key, 'boolval');
    }

    return $settings;
})();

return [
    $composerSettings,
];
