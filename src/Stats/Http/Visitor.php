<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Http;

use Psr\Http\Message\ServerRequestInterface;

/**
 * 统计需要了解的请求发起者信息：是否使用手机（Discourse 的
 * "手机访问量"）。
 */
final class Visitor
{
    private const MOBILE_PATTERN = '/Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i';

    public function __construct(
        private readonly ServerRequestInterface $request
    ) {
    }

    public function userAgent(): string
    {
        return mb_substr($this->request->getHeaderLine('User-Agent'), 0, 512);
    }

    public function isMobile(): bool
    {
        return preg_match(self::MOBILE_PATTERN, $this->userAgent()) === 1;
    }
}
