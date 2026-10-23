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

namespace Lcoy\Roselle\Community\Api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Group\Group;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Lcoy\Roselle\Community\AdminText;
use Lcoy\Roselle\Community\Community;
use Lcoy\Roselle\Community\UserPresenter;

/**
 * GET /api/lcoy-about——"关于"页面展示的全部内容，一次响应返回：
 * 管理员文本、联系方式、团队以及站点统计。
 *
 * 统计会扫描整个主题表和帖子表，因此缓存 30 分钟（Discourse 也会定期
 * 重新计算）。它们只统计访客能看到的内容——不含隐藏、私密或带受限标签
 * 的主题——因此对所有人一致，可以用同一份缓存。团队不进入缓存：
 * 它取决于询问者（隐藏的组、可见的用户），而且只是两次小查询。
 */
final class ShowAboutController implements RequestHandlerInterface
{
    public const CACHE_TTL = 1800;

    // `.v2`：旧的计数包含带受限标签的主题；新的键避免在更新后长达 30 分钟内
    // 仍返回旧数据。
    private const CACHE_KEY = 'lcoy.about.overview.v2';

    /** 团队超过这个数量就更像用户列表，而不是"关于"页面了。 */
    private const STAFF_LIMIT = 100;

    public function __construct(
        private readonly Community $community,
        private readonly SettingsRepositoryInterface $settings,
        private readonly Cache $cache,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly AdminText $text,
        private readonly UserPresenter $presenter,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::ABOUT_ENABLED);

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        $admins = $this->staff($actor, Group::ADMINISTRATOR_ID);
        $moderators = $this->staff($actor, Group::MODERATOR_ID, exceptGroup: Group::ADMINISTRATOR_ID);
        $showStaff = $this->community->enabled(Community::ABOUT_SHOW_STAFF);

        $overview = $this->cache->remember(self::CACHE_KEY, self::CACHE_TTL, fn () => $this->overview());

        $included = [];

        if ($showStaff) {
            foreach ([...$admins ?? [], ...$moderators ?? []] as $user) {
                $included[$user->id] ??= $this->presenter->one($user, $actor);
            }
        }

        return new JsonResponse([
            'aboutHtml' => $this->aboutHtml($request),
            'contactEmail' => $this->str(Community::ABOUT_CONTACT_EMAIL),
            'contactUrl' => $this->str(Community::ABOUT_CONTACT_URL),
            'members' => $overview['members'],
            'createdAt' => $overview['createdAt'],
            'adminCount' => $admins === null ? null : count($admins),
            'moderatorCount' => $moderators === null ? null : count($moderators),
            'admins' => $showStaff && $admins !== null ? array_map(fn (User $user) => (string) $user->id, $admins) : null,
            'moderators' => $showStaff && $moderators !== null ? array_map(fn (User $user) => (string) $user->id, $moderators) : null,
            'stats' => $this->community->enabled(Community::ABOUT_SHOW_STATS) ? $overview['stats'] : null,
            'cachedAt' => $overview['cachedAt'],
            'included' => array_values($included),
        ]);
    }

    /**
     * 操作者可以看到的团队成员，或在组对其隐藏时返回 `null`——此时该区块
     * 直接消失，而不是显示为空并暴露该组的存在。
     *
     * @return list<User>|null
     */
    private function staff(User $actor, int $groupId, ?int $exceptGroup = null): ?array
    {
        if (! Group::query()->whereVisibleTo($actor)->whereKey($groupId)->exists()) {
            return null;
        }

        $query = User::query()
            ->whereVisibleTo($actor)
            ->whereIn('users.id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId))
            ->with('groups')
            ->orderBy('users.username')
            ->limit(self::STAFF_LIMIT);

        if ($exceptGroup !== null) {
            $query->whereNotIn('users.id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $exceptGroup));
        }

        return $query->get()->all();
    }

    /** 管理员的"关于"文本，输出为 HTML（见 AdminText）。 */
    private function aboutHtml(ServerRequestInterface $request): ?string
    {
        return $this->text->render((string) $this->settings->get(Community::ABOUT_TEXT), $request);
    }

    /**
     * @return array{members: int, createdAt: string|null, cachedAt: string, stats: array<string, array<string, int|null>>}
     */
    private function overview(): array
    {
        $now = Carbon::now();
        $periods = [
            'day' => $now->copy()->subDay(),
            'week' => $now->copy()->subDays(7),
            'month' => $now->copy()->subDays(30),
            'all' => null,
        ];

        $stats = [
            'topics' => $this->countPeriods($periods, fn () => $this->publicDiscussions(), 'discussions.created_at'),
            'posts' => $this->countPeriods($periods, fn () => $this->publicPosts(), 'posts.created_at'),
            'users' => $this->countPeriods($periods, fn () => $this->members(), 'users.joined_at'),
            // 常规定义的"活跃用户"会等同于"用户"：Discourse
            // 也是让该单元格留空。
            'activeUsers' => $this->countPeriods($periods, fn () => $this->members(), 'users.last_seen_at', withTotal: false),
        ];

        if ($this->extensions->isEnabled('flarum-likes')) {
            $stats['likes'] = $this->countPeriods(
                $periods,
                fn () => $this->db->table('post_likes')->whereIn('post_likes.post_id', $this->publicPosts()->select('posts.id')),
                'post_likes.created_at'
            );
        }

        $createdAt = $this->members()->min('users.joined_at');

        return [
            'members' => $stats['users']['all'] ?? 0,
            'createdAt' => $createdAt ? Carbon::parse($createdAt)->toAtomString() : null,
            'cachedAt' => $now->toAtomString(),
            'stats' => $stats,
        ];
    }

    /**
     * @param array<string, Carbon|null> $periods
     * @param callable(): (Builder|QueryBuilder) $query
     * @return array<string, int|null>
     */
    private function countPeriods(array $periods, callable $query, string $column, bool $withTotal = true): array
    {
        $counts = [];

        foreach ($periods as $name => $since) {
            if ($since === null) {
                $counts[$name] = $withTotal ? $query()->count() : null;
                continue;
            }

            $counts[$name] = $query()->where($column, '>=', $since)->count();
        }

        return $counts;
    }

    /**
     * 访客能看到的主题：以访客身份应用核心和扩展的可见性规则（受限标签、
     * 审核……），与 Discourse 一样只统计公开内容。
     */
    private function publicDiscussions(): Builder
    {
        // Eloquent 转发给 query builder 的方法（whereNull、
        // whereIn……）会修改同一个查询；写成独立语句，变量在静态分析
        // 看来也仍是 Eloquent Builder。
        $guest = new Guest();
        $guestsCanView = $guest->hasPermission('viewForum');

        $query = $guestsCanView ? Discussion::whereVisibleTo($guest) : Discussion::query();
        $query->where('discussions.is_private', false);
        $query->whereNull('discussions.hidden_at');

        if (! $guestsCanView && $this->extensions->isEnabled('flarum-tags')) {
            // 论坛对访客关闭：以访客身份统计会全是零。此时
            // 以不在任何带独立权限的标签中的内容为准。
            $query->whereNotIn('discussions.id', fn (QueryBuilder $tagged) => $tagged
                ->select('discussion_tag.discussion_id')
                ->from('discussion_tag')
                ->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->where('tags.is_restricted', true));
        }

        return $query;
    }

    /** 公开主题中的回复和首帖，且均为公开内容。 */
    private function publicPosts(): Builder
    {
        $query = Post::query()
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false);

        $query->whereNull('posts.hidden_at')
            ->whereIn('posts.discussion_id', $this->publicDiscussions()->select('discussions.id'));

        return $query;
    }

    private function members(): Builder
    {
        return User::query()->where('users.is_email_confirmed', true);
    }

    private function str(string $key): ?string
    {
        $value = trim((string) $this->settings->get($key));

        return $value === '' ? null : $value;
    }
}
