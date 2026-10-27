<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Theme;

/**
 * 主题的字体族，以 `@config-lcoy-font` 传给 LESS。
 *
 * LESS 通过在 mixin（less/common/tokens.less）中匹配标识符来选择字体栈，
 * 因此只有已知的标识符能通过。
 */
final class FontFamily
{
    public const SETTING = 'lcoy.font';

    public const INTER = 'inter';

    public const JAKARTA = 'jakarta';

    public const SYSTEM = 'system';

    private const KNOWN_FAMILIES = [self::INTER, self::JAKARTA, self::SYSTEM];

    public function __invoke(mixed $value): string
    {
        return in_array($value, self::KNOWN_FAMILIES, true) ? $value : self::INTER;
    }
}
