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

namespace Lcoy\Roselle\Support;

use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Throwable;

/**
 * "这个表/列存在吗？"——无需每次请求都访问 information_schema。
 *
 * 主题的功能在使用可能尚不存在的表（迁移未运行、扩展已关闭）之前会检查
 * 架构。每次架构构建器检查都是一次 information_schema 查询，而一个已登录
 * 页面在每次请求中累计会做将近二十次（约 10 ms）。
 *
 * 这里每个被请求表的列会保存在 Flarum 的缓存中，键里带上已运行迁移的数量：
 * `migrate`（以及 `migrate:reset`）会改变这个数字，因此新的架构会被重新
 * 读取，无需依赖 `cache:clear`。每个进程只在有人询问时执行一次廉价的查询
 * （对 `migrations` 表做 `count`）。
 */
final class SchemaCache
{
    private const TTL = 7 * 24 * 3600;

    /** @var array<string, list<string>|null>|null 表 => 列（小写），null = 不存在 */
    private static ?array $tables = null;

    private static ?string $key = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Cache $cache,
    ) {
    }

    public function hasTable(string $table): bool
    {
        return $this->columns($table) !== null;
    }

    public function hasColumn(string $table, string $column): bool
    {
        return in_array(strtolower($column), $this->columns($table) ?? [], true);
    }

    /**
     * 表的列（小写），若表不存在则为 null。
     *
     * @return list<string>|null
     */
    public function columns(string $table): ?array
    {
        $tables = $this->load();

        if (! array_key_exists($table, $tables)) {
            $schema = $this->db->getSchemaBuilder();
            $tables[$table] = $schema->hasTable($table)
                ? array_values(array_map('strtolower', $schema->getColumnListing($table)))
                : null;
            self::$tables = $tables;
            $this->persist($tables);
        }

        return $tables[$table];
    }

    /** @return array<string, list<string>|null> */
    private function load(): array
    {
        if (self::$tables !== null) {
            return self::$tables;
        }

        try {
            self::$key = 'lcoy-roselle.schema.'.$this->db->table('migrations')->count();
            $cached = $this->cache->get(self::$key);
        } catch (Throwable) {
            // 没有 migrations 表或没有缓存：只使用进程内存。
            self::$key = null;
            $cached = null;
        }

        return self::$tables = is_array($cached) ? $cached : [];
    }

    /** @param array<string, list<string>|null> $tables */
    private function persist(array $tables): void
    {
        if (self::$key === null) {
            return;
        }

        try {
            $this->cache->put(self::$key, $tables, self::TTL);
        } catch (Throwable) {
            // 缓存只是捷径：没有它，下次请求会再次检查。
        }
    }
}
