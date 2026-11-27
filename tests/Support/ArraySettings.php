<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Support;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * 内存中的配置：主题的配置类只读取 `get()`，
 * 测试不需要为此使用数据库。
 */
final class ArraySettings implements SettingsRepositoryInterface
{
    /** @param array<string, mixed> $values */
    public function __construct(
        private array $values = []
    ) {
    }

    #[\Override]
    public function all(): array
    {
        return $this->values;
    }

    #[\Override]
    public function get(string $key, mixed $default = null): mixed
    {
        return $this->values[$key] ?? $default;
    }

    #[\Override]
    public function set(string $key, mixed $value): void
    {
        $this->values[$key] = $value;
    }

    #[\Override]
    public function delete(string $keyLike): void
    {
        unset($this->values[$keyLike]);
    }
}
