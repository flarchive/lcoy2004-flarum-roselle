<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Tests\Unit;

use Laminas\Diactoros\ServerRequest;
use PHPUnit\Framework\TestCase;
use Lcoy\Roselle\Stats\Http\Visitor;

/** Discourse 的移动端访问：由 User-Agent 决定是否为 "移动端"。 */
final class VisitorTest extends TestCase
{
    private function visitor(string $userAgent): Visitor
    {
        return new Visitor((new ServerRequest())->withHeader('User-Agent', $userAgent));
    }

    public function test_celular(): void
    {
        self::assertTrue($this->visitor('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')->isMobile());
        self::assertFalse($this->visitor('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130 Safari/537.36')->isMobile());
    }
}
