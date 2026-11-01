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

namespace Lcoy\Roselle\Theme\Logo;

use Flarum\Admin\LogoValidator;
use Flarum\Api\Controller\UploadImageController;
use Flarum\Foundation\ValidationException;
use Flarum\Mail\EmailLogo;
use Illuminate\Support\Arr;
use Intervention\Image\Interfaces\EncodedImageInterface;
use Laminas\Diactoros\StreamFactory;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Http\Message\UploadedFileInterface;

/**
 * 论坛 logo 的上传（管理 → 外观），支持 SVG。
 *
 * 核心会用 Intervention 把任何 logo 转成 60px 高的 WebP，而 Intervention
 * 无法读取 SVG。这里 SVG 直接通过——矢量在任何尺寸下都清晰——在清理后
 * 使用（{@see SvgSanitizer}）：该文件会从本站域名提供，而带有脚本的 SVG
 * 直接在浏览器中打开时会带着论坛的 cookie 执行。
 *
 * 其他格式沿用核心 UploadLogoController 的路径，这里做了复现：它的
 * `makeImage` 只声明编码后的图片作为返回类型，而 SVG 以 stream 返回。
 */
final class SvgLogoUploadController extends UploadImageController
{
    /** 与核心对后台图片使用的上限相同。 */
    private const MAX_BYTES = 2 * 1024 * 1024;

    protected string $filePathSettingKey = 'logo_path';
    protected string $filenamePrefix = 'logo';
    protected ?string $validator = LogoValidator::class;

    private bool $svg = false;
    private string $resolvedExtension = 'webp';

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $file = Arr::get($request->getUploadedFiles(), 'logo');
        $this->svg = $file instanceof UploadedFileInterface && self::isSvg($file);

        // 核心的校验器拒绝 image/svg+xml；SVG 在 makeImage() 中
        // 有独立的检查。
        if ($this->svg) {
            $this->validator = null;
        }

        return parent::handle($request);
    }

    #[\Override]
    protected function makeImage(UploadedFileInterface $file): EncodedImageInterface|StreamInterface
    {
        if (! $this->svg) {
            // 与核心一致：高度 60px，保留动画 GIF，其余转为 WebP。
            $image = $this->imageManager->read($file->getStream()->getMetadata('uri'))->scale(height: 60);

            if ($image->isAnimated()) {
                $this->resolvedExtension = 'gif';

                return $image->toGif();
            }

            $this->resolvedExtension = 'webp';

            return $image->toWebp();
        }

        if (($file->getSize() ?? 0) > self::MAX_BYTES) {
            throw new ValidationException(['logo' => '该 SVG 超过 2 MB。']);
        }

        $clean = SvgSanitizer::sanitize((string) $file->getStream());

        if ($clean === null) {
            throw new ValidationException(['logo' => '该文件不是有效的 SVG。']);
        }

        return (new StreamFactory())->createStream($clean);
    }

    /**
     * 与核心一样，把 logo 复制一份供邮件使用。该副本会经过 Intervention，
     * 而它无法读取 SVG：使用 SVG 时，邮件会使用专用的邮件 logo（若存在）。
     */
    #[\Override]
    protected function afterStore(ServerRequestInterface $request, UploadedFileInterface $file): void
    {
        if (! $this->svg) {
            $this->container->make(EmailLogo::class)->storeCopy($file->getStream()->getMetadata('uri'));
        }
    }

    #[\Override]
    protected function fileExtension(ServerRequestInterface $request, UploadedFileInterface $file): string
    {
        return $this->svg ? 'svg' : $this->resolvedExtension;
    }

    private static function isSvg(UploadedFileInterface $file): bool
    {
        $name = strtolower((string) $file->getClientFilename());

        return str_ends_with($name, '.svg') || $file->getClientMediaType() === 'image/svg+xml';
    }
}
