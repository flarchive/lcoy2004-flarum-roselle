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

namespace Lcoy\Roselle\Preload;

use Flarum\Api\Client;
use Flarum\Extension\ExtensionManager;
use Flarum\Frontend\Document;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

/**
 * 首次加载时的预加载，与核心对 `apiDocument` 的处理相同。
 *
 * 主题的一些界面在启动后立即请求数据（个人资料摘要会发出六个请求；
 * 通知页面、"关于"页面和标签页面各一个）。这里它们随 HTML 一起返回，
 * 放在 `payload.lcoyPreload` 中，使页面一出现就完整——没有"加载中"，
 * 也没有布局跳动。
 *
 * 请求与 JS 会发出的一致，通过内部 API 并使用相同的操作者：权限、过滤器
 * 以及其他扩展的字段同样生效。只有直接打开的当前路由会预加载，且每个
 * 请求都有上限（最多 100 项）。在应用内部导航时（不重新加载）不存在这些
 * 预加载，JS 照常请求。
 */
final class PreloadContent
{
    /**
     * 明显的爬虫/预取客户端：它们不执行 JS，预加载的数据只会浪费查询。
     */
    private const CRAWLER_PATTERN = '/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|google-inspectiontool|headless|curl|wget/i';

    public function __construct(
        private readonly Client $api,
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        if (preg_match(self::CRAWLER_PATTERN, $request->getHeaderLine('User-Agent')) === 1) {
            return;
        }

        try {
            $plan = $this->plan($document, $request);
        } catch (Throwable) {
            return;
        }

        $out = [];

        foreach ($plan as $entry) {
            [$path, $query] = $entry;
            // 第三项以另一种方式构建响应：基于已预加载的响应，
            // 或基于一个开销更小但结果相同的请求。
            //
            // 预加载只是一项优化：若某个请求（或构建它的 callable）抛错，
            // 整个页面不能因此崩溃——该项被跳过，由 JS 自行获取数据。
            try {
                $data = isset($entry[2])
                    ? ($entry[2])($out, fn (string $otherPath, array $otherQuery): ?object => $this->fetch($request, $otherPath, $otherQuery))
                    : $this->fetch($request, $path, $query);
            } catch (Throwable) {
                continue;
            }

            if ($data !== null) {
                $out[PreloadKey::make($path, $query)] = $data;
            }
        }

        if ($out) {
            $document->payload['lcoyPreload'] = $out;
        }
    }

    /**
     * 当前打开路由的请求：[API 路径, 参数, 以及可选的"如何在不发出与 JS
     * 相同请求的情况下构建响应"]。
     *
     * @return list<array{0: string, 1: array<string, mixed>, 2?: callable(array<string, object>, callable(string, array<string, mixed>): ?object): ?object}>
     */
    private function plan(Document $document, ServerRequestInterface $request): array
    {
        $guest = RequestUtil::getActor($request)->isGuest();
        $params = $request->getQueryParams();

        $actor = RequestUtil::getActor($request);

        return match ($request->getAttribute('routeName')) {
            'user' => $this->userPlan($document, (string) ($params['filter'] ?? ''), $guest ? null : (string) $actor->id),
            // 菜单和页面的列表；计数器已随会话用户返回。
            'notifications' => $guest ? [] : [self::NOTIFICATIONS],
            // 标签的"新帖 (N)"和"未读 (N)"：整个论坛的计数已随论坛返回。
            'tag' => $guest || ! isset($params['slug']) ? [] : [['/lcoy-counts', ['tag' => (string) $params['slug']]]],
            'lcoy.about' => [['/lcoy-about', []]],
            // `GuidelinesPage` 和 `AboutExtraPage`（同一个规则页面）。
            'lcoy.guidelines', 'lcoy.faq' => [['/lcoy-guidelines', []]],
            'lcoy.about_page' => preg_match('/^(\d+)/', (string) ($params['page'] ?? ''), $match) ? [['/lcoy-about-pages/'.$match[1], []]] : [],
            // `CategoriesPage` → `app.tagList.load([...])`。
            'lcoy.categories' => $this->extensions->isEnabled('flarum-tags') ? [['/tags', ['include' => 'children,lastPostedDiscussion,parent']]] : [],
            default => [],
        };
    }

    /** `NotificationListState`：第一页，不设上限（API 默认值）。 */
    private const NOTIFICATIONS = ['/notifications', ['page' => ['offset' => 0]]];

    /** @return list<array{0: string, 1: array<string, mixed>, 2?: callable(array<string, object>, callable(string, array<string, mixed>): ?object): ?object}> */
    private function userPlan(Document $document, string $filter, ?string $actorId): array
    {
        $user = $document->payload['apiDocument']->data ?? null;

        if (! is_object($user) || ($user->type ?? null) !== 'users') {
            return [];
        }

        $id = (string) $user->id;
        $slug = (string) ($user->attributes->slug ?? '');
        $username = (string) ($user->attributes->username ?? '');
        $comments = (int) ($user->attributes->commentCount ?? 0);

        $summaryOn = (bool) $this->settings->get('lcoy.user_summary', true);
        $summaryDefault = $summaryOn && $this->settings->get('lcoy.user_default_tab', 'summary') === 'summary';

        // 当摘要为默认选项卡时，`/u/:username` 会打开摘要（JS 会替换地址）。
        if ($filter === 'summary' || ($filter === '' && $summaryDefault)) {
            return $summaryOn && $slug !== '' ? $this->summaryPlan($id, $slug, $username, $comments) : [];
        }

        $own = $actorId !== null && $actorId === $id;

        // 仅本人可见的选项卡。
        if ($filter === 'notifications') {
            return $own ? [self::NOTIFICATIONS] : [];
        }

        if ($filter === 'bookmarks') {
            $include = ['post', 'post.discussion', 'post.user'];
            if ($this->extensions->isEnabled('flarum-tags')) {
                $include[] = 'post.discussion.tags';
            }

            // `BookmarksUserPage`：未搜索时，为第一页 20 条。
            return $own ? [['/bookmarks', ['include' => implode(',', $include), 'page' => ['offset' => 0, 'limit' => 20]]]] : [];
        }

        if ($filter === 'activity' || $filter === '' || $filter === 'posts') {
            // 核心的帖子列表（PostListState），并带上主题额外添加的标签。
            $include = ['user', 'discussion'];
            if ($this->extensions->isEnabled('flarum-tags')) {
                $include[] = 'discussion.tags';
            }

            return [['/posts', [
                'include' => implode(',', $include),
                'filter' => ['type' => 'comment', 'author' => $slug],
                'sort' => '-createdAt',
                'page' => ['offset' => 0],
            ]]];
        }

        return [];
    }

    /** 回复样本和"最后发帖"（UserSummaryPage、UserStats）所用帖子的字段。 */
    private const REPLY_POST_FIELDS = 'number,createdAt,likesCount,discussion';

    /**
     * 摘要的请求（`UserSummaryPage`、`UserStats`），参数与 JS 发送的一致。
     *
     * @return list<array{0: string, 1: array<string, mixed>, 2?: callable(array<string, object>, callable(string, array<string, mixed>): ?object): ?object}>
     */
    private function summaryPlan(string $id, string $slug, string $username, int $comments): array
    {
        $plan = [
            // `fields`（稀疏字段集）与 UserSummaryPage 相同：只包含列表绘制所需的内容。
            ['/discussions', ['filter' => ['author' => $slug], 'sort' => '-commentCount', 'include' => 'firstPost', 'fields' => ['discussions' => 'title,slug,commentCount,createdAt,firstPost', 'posts' => 'likesCount'], 'page' => ['limit' => 20, 'total' => 0]]],
            ['/posts', ['filter' => ['author' => $slug, 'type' => 'comment'], 'sort' => '-createdAt', 'include' => 'discussion', 'fields' => ['posts' => self::REPLY_POST_FIELDS, 'discussions' => 'title,slug'], 'page' => ['limit' => 50, 'total' => 0]]],
            // 没有 `usersummary` 功能时该路由不存在：返回 404，因此跳过。
            ["/lcoy-user-summary/$id", []],
        ];

        if ($comments > 0) {
            // 页头统计中的"最后发帖"：它就是上方回复样本中的第一条
            // （相同的过滤条件和排序）。
            $sampleKey = PreloadKey::make($plan[1][0], $plan[1][1]);
            $plan[] = [
                '/posts',
                ['filter' => ['author' => $slug, 'type' => 'comment'], 'sort' => '-createdAt', 'fields' => ['posts' => self::REPLY_POST_FIELDS], 'page' => ['limit' => 1, 'total' => 0]],
                static function (array $out) use ($sampleKey): ?object {
                    $first = $out[$sampleKey]->data[0] ?? null;

                    return is_object($first) ? (object) ['data' => [$first]] : null;
                },
            ];
        }

        if ($this->extensions->isEnabled('flarum-likes')) {
            // 给出的点赞：JS 只读取页面总数（`meta.page.total`）。
            // 它的请求会带回一整篇帖子，含默认包含项和内容的 HTML
            // （这里约 25 ms）；同一过滤器在不带属性和包含项时给出相同
            // 总数。帖子本身被省略：没有人读取它。
            $plan[] = [
                '/posts',
                ['filter' => ['likedBy' => $username], 'page' => ['limit' => 1]],
                static function (array $out, callable $fetch) use ($username): ?object {
                    $data = $fetch('/posts', ['filter' => ['likedBy' => $username], 'fields' => ['posts' => 'number'], 'include' => '', 'page' => ['limit' => 1]]);

                    return isset($data->meta) ? (object) ['data' => [], 'meta' => $data->meta] : null;
                },
            ];
        }

        return $plan;
    }

    /** @param array<string, mixed> $query */
    private function fetch(ServerRequestInterface $request, string $path, array $query): ?object
    {
        try {
            $api = $this->api->withParentRequest($request)->withQueryParams($query);

            if ($path === '/notifications') {
                // 该列表会把通知标记为已读并保存用户。请求的操作者已经过
                // 论坛的序列化，其他扩展会在它上面留下计算属性（草稿数、
                // 上传数），而 `save()` 会试图把它们写入列：使用同一用户
                // 的干净模型可以避免这种情况。
                $fresh = User::query()->find(RequestUtil::getActor($request)->id);

                if (! $fresh instanceof User) {
                    return null;
                }

                $api = $api->withActor($fresh);
            }

            $response = $api->get($path);

            if ($response->getStatusCode() !== 200) {
                return null;
            }

            // 对象仍然是对象（`attributes: {}` 不会变成 `[]`）。
            $data = json_decode((string) $response->getBody(), false);

            return is_object($data) ? $data : null;
        } catch (Throwable) {
            return null;
        }
    }
}
