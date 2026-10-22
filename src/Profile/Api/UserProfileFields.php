<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Profile\Api;

use Carbon\Carbon;
use DateTimeInterface;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Lcoy\Roselle\Profile\ProfileSettings;

/**
 * Os campos do perfil estendido no UserResource.
 *
 * Bio, local e site não estão aqui: o fof/user-bio e o fof/socialprofile já
 * cuidam deles.
 *
 * Leitura pública (é o que aparece no perfil e no cartão), exceto a data de
 * nascimento completa, que só o dono e a moderação veem — os outros recebem
 * só dia e mês, a menos que o usuário escolha mostrar o ano.
 *
 * Escrita: o próprio usuário e quem tem `user.edit` (ProfilePolicy). Campo
 * desligado no admin some da API nos dois sentidos.
 *
 * Nada vira HTML aqui: os textos curtos (título, status) saem como texto e o
 * Mithril os escapa no fórum.
 */
final class UserProfileFields
{
    /** Pelo menos um pictograma, bandeira ou tecla; o resto só os modificadores que montam um emoji. */
    public const EMOJI_PATTERN = '/^(?=.*(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\x{20E3}))(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\x{200D}\x{FE0F}\x{20E3}\x{1F3FB}-\x{1F3FF}#*0-9\x{E0020}-\x{E007F}])+$/u';

    /**
     * Controles C0/C1 (menos \t e \n) e os de direção do texto: os de
     * direção servem para disfarçar o que se lê (um link que parece outro).
     * O ZWJ e os seletores de variação ficam, porque montam os emojis.
     */
    private const CONTROL_PATTERN = '/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}-\x{009F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u';

    private const BIRTHDAY_SHOW_YEAR = 'canelaBirthdayShowYear';

    public function __construct(
        private readonly ProfileSettings $settings,
        private readonly TranslatorInterface $translator
    ) {
    }

    /** A preferência que guarda se o ano do aniversário é público. */
    public static function birthdayYearPreference(): string
    {
        return self::BIRTHDAY_SHOW_YEAR;
    }

    /**
     * @return array<int, Schema\Attribute>
     */
    public function __invoke(): array
    {
        return [
            ...$this->textFields(),
            ...$this->statusFields(),
            ...$this->birthdayFields(),

            Schema\Boolean::make('canelaCanEditProfile')
                ->visible(fn () => $this->settings->enabled())
                ->get(fn (User $user, Context $context) => $context->getActor()->can('canelaEditProfile', $user)),

            Schema\Boolean::make('canelaCanEditTitle')
                ->visible(fn () => $this->settings->fieldEnabled(ProfileSettings::TITLE))
                ->get(fn (User $user, Context $context) => $context->getActor()->can('canelaEditTitle', $user)),
        ];
    }

    /** @return array<int, Schema\Attribute> */
    private function textFields(): array
    {
        return [
            Schema\Str::make('canelaTitle')
                ->property('canela_title')
                ->visible(fn () => $this->settings->fieldEnabled(ProfileSettings::TITLE))
                ->writable(fn (User $user, Context $context) => $context->updating() && $context->getActor()->can('canelaEditTitle', $user))
                ->nullable()
                ->maxLength(60)
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_title', self::singleLine($value))),
        ];
    }

    /**
     * O status do Discourse: emoji + frase + "limpar depois de…". O que já
     * venceu sai como nulo — não precisa de tarefa agendada para apagar, e o
     * dado antigo fica até o usuário pôr outro.
     *
     * @return array<int, Schema\Attribute>
     */
    private function statusFields(): array
    {
        $enabled = fn () => $this->settings->fieldEnabled(ProfileSettings::STATUS);
        $writable = fn (User $user, Context $context) => $this->canWrite(ProfileSettings::STATUS, $user, $context);

        return [
            Schema\Str::make('canelaStatusEmoji')
                ->visible($enabled)
                ->writable($writable)
                ->nullable()
                ->maxLength(16)
                ->regex(self::EMOJI_PATTERN)
                ->validationMessages(['canelaStatusEmoji.regex' => $this->trans('invalid_status_emoji')])
                ->get(fn (User $user) => self::statusActive($user) ? $user->getAttribute('canela_status_emoji') : null)
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_status_emoji', self::singleLine($value))),

            Schema\Str::make('canelaStatusText')
                ->visible($enabled)
                ->writable($writable)
                ->nullable()
                ->maxLength(100)
                ->get(fn (User $user) => self::statusActive($user) ? $user->getAttribute('canela_status_text') : null)
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_status_text', self::singleLine($value))),

            Schema\DateTime::make('canelaStatusUntil')
                ->visible($enabled)
                ->writable($writable)
                ->nullable()
                ->rule('after:now')
                ->validationMessages(['canelaStatusUntil.after' => $this->trans('invalid_status_until')])
                ->get(fn (User $user) => self::statusActive($user) ? $user->getAttribute('canela_status_until') : null)
                ->set(function (User $user, ?DateTimeInterface $value) {
                    $user->setAttribute('canela_status_until', $value ? Carbon::instance($value)->utc() : null);
                }),
        ];
    }

    /** @return array<int, Schema\Attribute> */
    private function birthdayFields(): array
    {
        $enabled = fn () => $this->settings->fieldEnabled(ProfileSettings::BIRTHDAY);
        $private = fn (User $user, Context $context) => $enabled() && $this->isOwnerOrEditor($user, $context);
        $writable = fn (User $user, Context $context) => $this->canWrite(ProfileSettings::BIRTHDAY, $user, $context);

        return [
            // Público: "MM-DD", ou "AAAA-MM-DD" se o usuário mostrar o ano.
            Schema\Str::make('canelaBirthday')
                ->visible($enabled)
                ->get(function (User $user): ?string {
                    $date = $user->getAttribute('canela_birthday');

                    if (! $date instanceof DateTimeInterface) {
                        return null;
                    }

                    return $user->getPreference(self::BIRTHDAY_SHOW_YEAR) ? $date->format('Y-m-d') : $date->format('m-d');
                }),

            Schema\Date::make('canelaBirthdayDate')
                ->property('canela_birthday')
                ->visible($private)
                ->writable($writable)
                ->nullable()
                ->rule('before:today')
                ->rule('after_or_equal:1900-01-01')
                ->validationMessages([
                    'canelaBirthdayDate.before' => $this->trans('invalid_birthday'),
                    'canelaBirthdayDate.after_or_equal' => $this->trans('invalid_birthday'),
                ])
                ->set(function (User $user, ?DateTimeInterface $value) {
                    $user->setAttribute('canela_birthday', $value ? Carbon::instance($value)->startOfDay() : null);
                }),

            Schema\Boolean::make('canelaBirthdayShowYear')
                ->visible($private)
                ->writable($writable)
                ->get(fn (User $user) => (bool) $user->getPreference(self::BIRTHDAY_SHOW_YEAR))
                ->set(fn (User $user, bool $value) => $user->setPreference(self::BIRTHDAY_SHOW_YEAR, $value)),
        ];
    }

    private function canWrite(string $field, User $user, Context $context): bool
    {
        // Só na edição: o cadastro não pede nada disso, e o Create do core
        // validaria estes campos contra um usuário que ainda não existe.
        return $context->updating()
            && $this->settings->fieldEnabled($field)
            && $context->getActor()->can('canelaEditProfile', $user);
    }

    private function isOwnerOrEditor(User $user, Context $context): bool
    {
        $actor = $context->getActor();

        return $actor->id === $user->id || $actor->can('edit', $user);
    }

    private static function statusActive(User $user): bool
    {
        $until = $user->getAttribute('canela_status_until');

        return $until === null || Carbon::parse($until)->isFuture();
    }

    /** Uma linha só, sem controles nem espaços nas pontas; vazio vira nulo. */
    private static function singleLine(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = (string) preg_replace(self::CONTROL_PATTERN, '', str_replace(["\r", "\n", "\t"], ' ', $value));
        $value = trim((string) preg_replace('/ {2,}/', ' ', $value));

        return $value === '' ? null : $value;
    }

    private function trans(string $key): string
    {
        return $this->translator->trans('lcoy-roselle.api.profile.'.$key);
    }
}
