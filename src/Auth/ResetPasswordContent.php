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

namespace Lcoy\Roselle\Auth;

use DateTime;
use Flarum\Frontend\Document;
use Flarum\User\Exception\InvalidConfirmationTokenException;
use Flarum\User\PasswordToken;
use Illuminate\Contracts\Support\MessageProvider;
use Illuminate\Contracts\View\Factory;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * 论坛中的 `/reset/{token}`（主题的"重置密码"页面），用来替代核心的
 * 独立页面（reset-password.blade.php）。
 *
 * 校验 token 的方式与核心的 ResetPasswordController 完全一致（没有 token
 * 返回 404，超过一天视为 token 无效），并把 token 和上一次尝试的错误交给
 * JS：核心的 SavePasswordController 仍会收到 POST /reset，在校验失败时
 * 带着会话中的错误回到这里——这些错误已由 ShareErrorsFromSession
 * 从会话中取出并共享给视图。
 */
final class ResetPasswordContent
{
    public function __construct(
        private readonly Factory $view,
        private readonly TranslatorInterface $translator
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $token = PasswordToken::findOrFail((string) Arr::get($request->getQueryParams(), 'token'));

        if ($token->created_at < new DateTime('-1 day')) {
            throw new InvalidConfirmationTokenException();
        }

        $errors = $this->view->shared('errors');
        $messages = $errors instanceof MessageProvider ? $errors->getMessageBag()->all() : [];

        $document->title = $this->translator->trans('core.views.reset_password.title');
        $document->payload['lcoyReset'] = [
            'token' => $token->token,
            'errors' => array_values(array_map('strval', $messages)),
        ];
    }
}
