<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Lcoy\Roselle\Preload\PreloadKey;

/**
 * 预加载的键必须与 JS 的 `preloadKey()` 生成的结果一致
 * （js/src/forum/utils/preload.ts），否则页面会重新请求全部内容。
 */
final class PreloadKeyTest extends TestCase
{
    public function test_pares_em_ordem_e_sem_barras_nas_pontas(): void
    {
        self::assertSame('lcoy-about?', PreloadKey::make('/lcoy-about/'));
        self::assertSame('posts?b=2&c=3', PreloadKey::make('posts', ['c' => 3, 'b' => '2']));
    }

    public function test_arrays_aninhados_viram_colchetes(): void
    {
        self::assertSame(
            'posts?filter[author]=ramon&filter[type]=comment&page[limit]=20&sort=-createdAt',
            PreloadKey::make('posts', ['sort' => '-createdAt', 'filter' => ['type' => 'comment', 'author' => 'ramon'], 'page' => ['limit' => 20]])
        );
    }

    public function test_vazio_e_nulo_ficam_de_fora_como_no_js(): void
    {
        self::assertSame('users?q=a', PreloadKey::make('users', ['q' => 'a', 'group' => '', 'page' => null, 'filter' => []]));
    }

    public function test_booleanos_como_no_js(): void
    {
        self::assertSame('x?a=true&b=false', PreloadKey::make('x', ['a' => true, 'b' => false]));
    }
}
