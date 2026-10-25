<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Yaml\Yaml;

/**
 * 翻译的一致性：en.yml 中的每个键都存在于每种语言中，反之亦然。
 *
 * 某种语言中遗漏的键会以原始形式（或英文）显示给使用
 * 另一种语言的用户，而 JS 构建不会报告这一点。en.yml 是基准。
 */
final class LocaleParityTest extends TestCase
{
    private const LOCALES = ['en', 'zh-Hans'];

    /** @return array<string, array{string}> 与 en 比较的语言 */
    public static function translations(): array
    {
        $out = [];

        foreach (self::LOCALES as $locale) {
            if ($locale !== 'en') {
                $out[$locale] = [$locale];
            }
        }

        return $out;
    }

    /** @return array<string, string> 带点的键 => 文本，来自所有叶子节点 */
    private function entriesOf(string $locale): array
    {
        return $this->flatten((array) Yaml::parseFile(dirname(__DIR__, 2)."/locale/$locale.yml"));
    }

    /** @return list<string> 所有叶子节点的带点键，按顺序排列 */
    private function keysOf(string $locale): array
    {
        $keys = array_keys($this->entriesOf($locale));
        sort($keys);

        return $keys;
    }

    /**
     * @param  array<array-key, mixed> $data
     * @return array<string, string>
     */
    private function flatten(array $data, string $prefix = ''): array
    {
        $entries = [];

        foreach ($data as $key => $value) {
            $dotted = $prefix === '' ? (string) $key : "$prefix.$key";

            if (is_array($value)) {
                $entries += $this->flatten($value, $dotted);
            } else {
                $entries[$dotted] = (string) $value;
            }
        }

        return $entries;
    }

    /**
     * 文本中的变量（`{name}`、`{count, plural…`）和标签（`<a>`）。
     *
     * 译者会重写句子，但被改掉的占位符会从界面上消失（或
     * 破坏 ICU）。复数的分支（`one {…}`）可以不同：日语只用 `other`。
     *
     * @return list<string>
     */
    private function placeholdersOf(string $text): array
    {
        // 分支文本（"one {…}"、"=0 {…}"）会被翻译：不算作变量
        $text = (string) preg_replace('/(?:\b(?:zero|one|two|few|many|other)|=\d+)\s*\{/', '(', $text);
        // 只算名称：en 中的 "{count}" 和另一种语言中的 "{count, plural…}" 视为相同
        preg_match_all('/\{\s*([A-Za-z_]\w*)\s*[,}]|<(\/?(?:a|b|i|em|strong|code|kbd|br|span))\b/', $text, $m);
        $tokens = array_values(array_unique(array_map(static fn (string $var, string $tag): string => $var !== '' ? '{'.$var : '<'.$tag, $m[1], $m[2])));
        sort($tokens);

        return $tokens;
    }

    #[DataProvider('translations')]
    public function test_traduz_todas_as_chaves_do_en(string $locale): void
    {
        $missing = array_values(array_diff($this->keysOf('en'), $this->keysOf($locale)));

        self::assertSame([], $missing, "$locale.yml 中缺少：\n  - ".implode("\n  - ", $missing));
    }

    #[DataProvider('translations')]
    public function test_nao_tem_chaves_ausentes_do_en(string $locale): void
    {
        $extra = array_values(array_diff($this->keysOf($locale), $this->keysOf('en')));

        self::assertSame([], $extra, "$locale.yml 中多出（en.yml 中缺少）：\n  - ".implode("\n  - ", $extra));
    }

    #[DataProvider('translations')]
    public function test_placeholders_iguais_aos_do_en(string $locale): void
    {
        $en = $this->entriesOf('en');
        $diff = [];

        foreach ($this->entriesOf($locale) as $key => $text) {
            if (isset($en[$key]) && $this->placeholdersOf($en[$key]) !== $this->placeholdersOf($text)) {
                $diff[] = $key;
            }
        }

        self::assertSame([], $diff, "$locale.yml 中的占位符与 en 不同：\n  - ".implode("\n  - ", $diff));
    }

    public function test_todos_os_idiomas_sao_lidos(): void
    {
        foreach (self::LOCALES as $locale) {
            self::assertNotEmpty($this->keysOf($locale), "$locale.yml 没有任何键");
        }
    }
}
