<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Profile;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * As chaves do perfil estendido num lugar só.
 *
 * Cada campo tem a própria chave, mas todos dependem da chave-mestra: o admin
 * desliga o recurso inteiro sem perder a escolha de cada campo. A mesma regra
 * vale para a API (campos somem, rotas respondem 404) e para o fórum.
 */
final class ProfileSettings
{
    public const ENABLED = 'canela.profile_enabled';

    public const TITLE = 'title';

    public const STATUS = 'status';

    public const BIRTHDAY = 'birthday';

    /** Campos que o admin liga e desliga um a um (`canela.profile_<campo>`). */
    public const FIELDS = [self::TITLE, self::STATUS, self::BIRTHDAY];

    /** O próprio usuário escolhe o título; desligado, só a moderação define. */
    public const TITLE_SELF = 'canela.profile_title_self';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public static function fieldKey(string $field): string
    {
        return 'canela.profile_'.$field;
    }

    public function enabled(): bool
    {
        return $this->bool(self::ENABLED);
    }

    public function fieldEnabled(string $field): bool
    {
        return $this->enabled() && $this->bool(self::fieldKey($field));
    }

    public function titleSelfEditable(): bool
    {
        return $this->bool(self::TITLE_SELF);
    }

    private function bool(string $key): bool
    {
        // O repositório devolve strings ('1', '0', ''), e o default registrado
        // no extender chega como booleano: os dois formatos passam por aqui.
        $value = $this->settings->get($key);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }
}
