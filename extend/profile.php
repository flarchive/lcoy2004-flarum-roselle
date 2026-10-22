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
 * Perfil estendido, como o do Discourse: título, status (emoji + frase +
 * validade) e aniversário. Cada campo liga e desliga no admin; a chave-mestra
 * desliga todos de uma vez.
 *
 * Bio, local, site e capa não estão aqui: quem cuida é o fof/user-bio, o
 * fof/socialprofile e o forumaker/profile-cover.
 */

use Flarum\Api\Resource\UserResource;
use Flarum\Extend;
use Flarum\User\User;
use Lcoy\Roselle\Profile\Access\ProfilePolicy;
use Lcoy\Roselle\Profile\Api\UserProfileFields;
use Lcoy\Roselle\Profile\ProfileSettings;

// Numa closure: o extend.php principal faz `require` deste arquivo no escopo
// dele, e uma variável daqui (`$settings`…) sobrescreveria as de lá.
return (static function (): array {
    $settings = (new Extend\Settings())
        ->default(ProfileSettings::ENABLED, true)
        ->serializeToForum('canelaProfileEnabled', ProfileSettings::ENABLED, 'boolval')
        ->default(ProfileSettings::TITLE_SELF, true)
        ->serializeToForum('canelaProfileTitleSelf', ProfileSettings::TITLE_SELF, 'boolval');

    // canela.profile_title → canelaProfileTitle, e assim por diante.
    foreach (ProfileSettings::FIELDS as $field) {
        $key = ProfileSettings::fieldKey($field);
        $settings->default($key, true)->serializeToForum('canelaProfile'.ucfirst($field), $key, 'boolval');
    }

    return [
        $settings,

        (new Extend\Model(User::class))
            ->cast('canela_status_until', 'datetime')
            ->cast('canela_birthday', 'date'),

        (new Extend\User())
            ->registerPreference(UserProfileFields::birthdayYearPreference(), 'boolval', false),

        (new Extend\ApiResource(UserResource::class))
            ->fields(UserProfileFields::class),

        (new Extend\Policy())
            ->modelPolicy(User::class, ProfilePolicy::class),
    ];
})();
