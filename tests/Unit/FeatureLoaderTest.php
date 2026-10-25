<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * extend.php 的资源配置加载器只启用 extend/.enabled 中的资源。
 * 其中写错的名称会让该资源悄无声息地关闭；而某个资源若不返回
 * extender 列表，则会让启动失败。
 */
final class FeatureLoaderTest extends TestCase
{
    private function root(): string
    {
        return dirname(__DIR__, 2);
    }

    /** @return list<string> */
    private function enabled(): array
    {
        // 与 extend.php 相同的读取方式：名称以空格、换行或逗号分隔。
        $text = (string) file_get_contents($this->root().'/extend/.enabled');

        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $text) ?: [])));
    }

    public function test_todo_recurso_ligado_tem_arquivo(): void
    {
        foreach ($this->enabled() as $feature) {
            self::assertMatchesRegularExpression('/^[a-z][a-z0-9_-]*$/', $feature, "extend/.enabled 中的名称无效：$feature");
            self::assertFileExists($this->root()."/extend/$feature.php", "extend/.enabled 启用了 \"$feature\"，但 extend/$feature.php 不存在");
        }
    }

    public function test_recursos_nao_se_repetem(): void
    {
        $enabled = $this->enabled();

        self::assertSame(array_values(array_unique($enabled)), $enabled, 'extend/.enabled 中存在重复的资源');
    }

    public function test_todo_arquivo_de_recurso_devolve_algo(): void
    {
        foreach (glob($this->root().'/extend/*.php') ?: [] as $file) {
            self::assertMatchesRegularExpression('/^\s*return\s/m', (string) file_get_contents($file), basename($file).' 必须返回 extender 列表');
        }
    }
}
