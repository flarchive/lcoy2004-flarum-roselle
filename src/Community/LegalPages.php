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

namespace Lcoy\Roselle\Community;

use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;
use Throwable;

/**
 * "关于"页面中的"服务条款"和"隐私政策"选项卡（Discourse 的 /tos 和
 * /privacy 路由），以及 fof/terms 中的其他政策。
 *
 * fof/terms 的政策优先——注册时要求用户接受的就是这些，链接必须一致。
 * 它们只有名称和地址，因此主题根据名称判断哪个是哪个（"Termos de uso"、
 * "Privacidade"……）；对不上的则按其自身名称作为选项卡。没有政策时，
 * 使用主题后台设置的地址。没有地址时，该选项卡不显示。
 */
final class LegalPages
{
    private const TOS_PATTERN = '/termo|terms|\btos\b|servi[cç]o|condi[cç]/iu';

    private const PRIVACY_PATTERN = '/privac|privad|lgpd|gdpr|dados pessoais|personal data/iu';

    /** @var list<array{key: string, title: string|null, url: string}>|null */
    private ?array $memo = null;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    /**
     * `key` 为 "tos"、"privacy" 或 "policy-<id>"；`title` 只出现在额外的政策
     * 中（两个固定项使用论坛的翻译）。
     *
     * @return list<array{key: string, title: string|null, url: string}>
     */
    public function all(): array
    {
        if ($this->memo !== null) {
            return $this->memo;
        }

        $pages = ['tos' => null, 'privacy' => null];
        $extra = [];

        foreach ($this->policies() as $policy) {
            $url = trim((string) $policy->url);
            $name = (string) $policy->name;

            if (! $this->isUrl($url)) {
                continue;
            }

            if ($pages['privacy'] === null && preg_match(self::PRIVACY_PATTERN, $name) === 1) {
                $pages['privacy'] = ['key' => 'privacy', 'title' => null, 'url' => $url];
            } elseif ($pages['tos'] === null && preg_match(self::TOS_PATTERN, $name) === 1) {
                $pages['tos'] = ['key' => 'tos', 'title' => null, 'url' => $url];
            } else {
                $extra[] = ['key' => 'policy-'.$policy->id, 'title' => $name, 'url' => $url];
            }
        }

        foreach (['tos' => Community::TOS_URL, 'privacy' => Community::PRIVACY_URL] as $key => $setting) {
            $url = trim((string) $this->settings->get($setting));

            if ($pages[$key] === null && $this->isUrl($url)) {
                $pages[$key] = ['key' => $key, 'title' => null, 'url' => $url];
            }
        }

        return $this->memo = [...array_values(array_filter($pages)), ...$extra];
    }

    public function url(string $key): ?string
    {
        foreach ($this->all() as $page) {
            if ($page['key'] === $key) {
                return $page['url'];
            }
        }

        return null;
    }

    /** @return iterable<object> */
    private function policies(): iterable
    {
        $repository = 'FoF\\Terms\\Repositories\\PolicyRepository';

        if (! $this->extensions->isEnabled('fof-terms') || ! class_exists($repository)) {
            return [];
        }

        try {
            // fof/terms 的仓库会永久缓存这些政策
            // （保存时清除）：因此不会每个页面产生一次查询。
            return resolve($repository)->all();
        } catch (Throwable $error) {
            error_log('[lcoy/roselle] fof/terms 政策: '.$error->getMessage());

            return [];
        }
    }

    /** 完整地址（https://…）或论坛自身的路径（/termos）。 */
    private function isUrl(string $url): bool
    {
        return $url !== '' && preg_match('#^(https?://[^\s]+|/[^\s/][^\s]*)$#i', $url) === 1;
    }
}
