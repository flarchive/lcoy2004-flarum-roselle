<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * extend.php 会加载 extend/ 中的每个文件。某个资源若不返回 extender
 * 列表，启动就会失败；而资源列表任何时候都不能来自请求。
 */
final class FeatureLoaderTest extends TestCase
{
    private function root(): string
    {
        return dirname(__DIR__, 2);
    }

    public function test_nomes_dos_recursos_sao_validos(): void
    {
        $files = glob($this->root().'/extend/*.php') ?: [];

        self::assertNotEmpty($files);

        foreach ($files as $file) {
            self::assertMatchesRegularExpression(
                '/^[a-z][a-z0-9_-]*$/',
                basename($file, '.php'),
                'extend/ 中的名称无效：'.basename($file)
            );
        }
    }

    public function test_todo_arquivo_de_recurso_devolve_algo(): void
    {
        foreach (glob($this->root().'/extend/*.php') ?: [] as $file) {
            self::assertMatchesRegularExpression(
                '/^\s*return\s/m',
                (string) file_get_contents($file),
                basename($file).' 必须返回 extender 列表'
            );
        }
    }

    public function test_lista_de_recursos_nao_vem_da_requisicao(): void
    {
        // 能改资源列表的请求头或参数，等于让任何访客自行开关论坛的一部分。
        $source = (string) file_get_contents($this->root().'/extend.php');

        self::assertDoesNotMatchRegularExpression('/\$_(SERVER|GET|POST|REQUEST|COOKIE)\b|getallheaders\s*\(/', $source);
    }
}