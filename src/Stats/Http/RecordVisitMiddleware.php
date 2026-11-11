<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats\Http;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Lcoy\Roselle\Stats\StatsSettings;
use Lcoy\Roselle\Stats\VisitRecorder;
use Throwable;

/**
 * 为已登录用户记录访问日期。
 *
 * 在论坛和 API 两条链路上都生效：论坛页面只加载一次，而让选项卡隔夜
 * 开着的人之后只通过 API 浏览——若没有这条中间件，第二天就不会
 * 被记录。
 */
final class RecordVisitMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly VisitRecorder $visits,
        private readonly LoggerInterface $logger
    ) {
    }

    #[\Override]
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isGuest() && $this->settings->activityEnabled()) {
            try {
                $this->visits->touch($actor, (new Visitor($request))->isMobile());
            } catch (Throwable $error) {
                // 统计失败不应让页面崩溃。
                $this->logger->warning('[lcoy] 访问记录未写入: '.$error->getMessage());
            }
        }

        return $handler->handle($request);
    }
}
