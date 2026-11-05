<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Support;

use Illuminate\Database\SQLiteConnection;
use PDO;

/**
 * 每次测试都新建的内存 SQLite 连接：主题的 SQL 是
 * query builder 的写法（可移植），因此依赖条件写入或唯一索引的规则
 * 可以在没有 MariaDB 的情况下验证。
 */
final class Sqlite
{
    public static function connection(): SQLiteConnection
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // 带名称：事务管理器以连接名作为键，
        // 而 Eloquent 会把名称写入已保存的模型（解析器认识 'default'）。
        return new SQLiteConnection($pdo, ':memory:', '', ['name' => 'default']);
    }
}
