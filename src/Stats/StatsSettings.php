<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * 统计相关的设置集中在一处，并已完成转换。
 *
 * 核心把所有值都存成字符串（"1"、"0"、"8"），而该功能的每个部分——
 * 计数、阅读记录——都需要用相同的默认值做同样的读取；若把
 * `(bool) $settings->get()` 分散到各处，某个默认值就会在无人察觉的情况下
 * 与其他默认值不一致。
 */
final class StatsSettings
{
    public const COUNTS_ENABLED = 'lcoy.stats_counts_enabled';

    public const NEW_DAYS = 'lcoy.stats_new_days';

    public const ACTIVITY_ENABLED = 'lcoy.stats_activity_enabled';

    /** "浏览量"列的热度区间（topic_views_heat_low/medium/high）。 */
    public const HEAT_LOW = 'lcoy.topic_views_heat_low';

    public const HEAT_MEDIUM = 'lcoy.topic_views_heat_medium';

    public const HEAT_HIGH = 'lcoy.topic_views_heat_high';

    public const DEFAULT_HEAT_LOW = 1000;

    public const DEFAULT_HEAT_MEDIUM = 2000;

    public const DEFAULT_HEAT_HIGH = 3500;

    /** 在 Discourse 中，"新帖"指最近 2 天内创建、且用户尚未打开过的主题。 */
    public const DEFAULT_NEW_DAYS = 2;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public function countsEnabled(): bool
    {
        return $this->bool(self::COUNTS_ENABLED);
    }

    public function activityEnabled(): bool
    {
        return $this->bool(self::ACTIVITY_ENABLED);
    }

    /** 0 = 不限制时间范围：只以"全部标记为已读"的日期或注册日期为准。 */
    public function newDays(): int
    {
        return $this->int(self::NEW_DAYS, self::DEFAULT_NEW_DAYS, 0, 365);
    }

    private function bool(string $key): bool
    {
        // 默认值（开启）来自 extend 的 ->default()；这里只做转换。
        return in_array($this->settings->get($key), [true, 1, '1', 'true'], true);
    }

    private function int(string $key, int $fallback, int $min, int $max): int
    {
        $value = $this->settings->get($key);

        if (! is_numeric($value)) {
            return $fallback;
        }

        return max($min, min($max, (int) $value));
    }
}
