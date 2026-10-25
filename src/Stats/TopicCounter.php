<?php

declare(strict_types=1);

namespace Lcoy\Roselle\Stats;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Discourse 的"新帖 (N)"和"未读 (N)"计数，提供给已登录用户。
 *
 * - **新帖**：在最后一次"全部标记为已读"（或注册）之后创建、位于最近 N 天
 *   之内、由他人发布，且从未被打开过。
 * - **未读**：已打开过，但在最后阅读之后又有回复。
 *
 * 两者都止于 {@see self::LIMIT}：这个数字只用于选项卡的 "(99+)"，
 * 而在每次页面加载时统计一个旧论坛的数万个主题纯属浪费。每次查询最多
 * 取 LIMIT 个 id。
 */
final class TopicCounter
{
    public const LIMIT = 100;

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly ExtensionManager $extensions
    ) {
    }

    /**
     * @param int[] $tagIds 只统计这些标签下的主题（分类页面只统计
     *                      属于它的内容，与 Discourse 一致）
     */
    public function newCount(User $actor, array $tagIds = []): int
    {
        return $this->counts($actor, $tagIds)['new'];
    }

    /**
     * @param int[] $tagIds
     */
    public function unreadCount(User $actor, array $tagIds = []): int
    {
        return $this->counts($actor, $tagIds)['unread'];
    }

    /** @var array<string, array{new: int, unread: int}> */
    private array $counted = [];

    /**
     * 两个计数合并为一次查询（两次带限制的搜索的 UNION ALL），并保存在
     * 该实例上：论坛会分别请求"新帖"和"未读"两个属性，而原本是两次
     * 带完整可见性作用域的查询。
     *
     * @param int[] $tagIds
     * @return array{new: int, unread: int}
     */
    private function counts(User $actor, array $tagIds): array
    {
        if ($actor->isGuest()) {
            return ['new' => 0, 'unread' => 0];
        }

        $key = $actor->id.':'.implode(',', $tagIds);

        if (isset($this->counted[$key])) {
            return $this->counted[$key];
        }

        $new = $this->baseQuery($actor, $tagIds);
        $this->constrainNew($new, $actor);
        $unread = $this->baseQuery($actor, $tagIds);
        $this->constrainUnread($unread, $actor);

        // 每一部分都有自己的 LIMIT（语法会把各部分放在括号中）。
        $part = static fn (Builder $query, string $kind): QueryBuilder => $query->toBase()
            ->select('discussions.id')
            ->selectRaw('? as lcoy_kind', [$kind])
            ->limit(self::LIMIT);

        $kinds = $part($new, 'new')->unionAll($part($unread, 'unread'))->pluck('lcoy_kind')->countBy()->all();

        return $this->counted[$key] = ['new' => (int) ($kinds['new'] ?? 0), 'unread' => (int) ($kinds['unread'] ?? 0)];
    }

    /**
     * "新帖"：计数与列表的 `lcoyNew` 过滤器使用同一规则，使选项卡的
     * "(N)"与选项卡展示的内容一致。
     */
    public function constrainNew(Builder $query, User $actor): void
    {
        $query
            ->where('discussions.created_at', '>', $this->newSince($actor))
            // 主题的作者已经"读过"它；NULL 表示作者已被删除。
            ->where(fn (Builder $query) => $query->whereNull('discussions.user_id')->orWhere('discussions.user_id', '!=', $actor->id))
            ->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_user')
                ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                ->where('discussion_user.user_id', $actor->id)
                ->whereNotNull('discussion_user.last_read_post_number'));
    }

    /**
     * Discourse 的"未读"：已打开过，且在最后阅读之后有回复。核心的
     * `unread` 过滤器也把从未打开的主题算进去（这里属于"新帖"）；
     * 因此列表使用 `lcoyUnread`，采用同一条规则。
     */
    public function constrainUnread(Builder $query, User $actor): void
    {
        $query
            ->whereExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_user')
                ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                ->where('discussion_user.user_id', $actor->id)
                ->whereNotNull('discussion_user.last_read_post_number')
                ->whereColumn('discussion_user.last_read_post_number', '<', 'discussions.last_post_number'))
            // "全部标记为已读"也会把已打开过的内容清零。
            ->when($actor->marked_all_as_read_at, fn (Builder $query, $markedAt) => $query->where('discussions.last_posted_at', '>', $markedAt));
    }

    /**
     * 两种计数共同的纳入范围：用户可见的内容，除去私信（Discourse 单独
     * 统计它们）、隐藏主题，以及用户自己要求不看的内容——被忽略的主题和
     * 主列表中隐藏的标签，与已有的"全部"列表行为一致。
     *
     * @param int[] $tagIds
     */
    private function baseQuery(User $actor, array $tagIds = []): Builder
    {
        $query = Discussion::query()
            ->whereVisibleTo($actor)
            ->where('discussions.is_private', false)
            ->whereNull('discussions.hidden_at');

        if ($tagIds && $this->extensions->isEnabled('flarum-tags')) {
            $query->whereExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_tag')
                ->whereColumn('discussion_tag.discussion_id', 'discussions.id')
                ->whereIn('discussion_tag.tag_id', $tagIds));
        }

        if ($this->extensions->isEnabled('flarum-subscriptions')) {
            $query->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_user')
                ->whereColumn('discussion_user.discussion_id', 'discussions.id')
                ->where('discussion_user.user_id', $actor->id)
                ->where('discussion_user.subscription', 'ignore'));
        }

        // 仅在全局计数中：某个标签的页面（即使是隐藏标签）
        // 会不加此过滤地列出其主题，正如核心在存在过滤条件时
        // 所做的那样——否则隐藏标签的页面会始终显示 0。
        if (! $tagIds && $this->extensions->isEnabled('flarum-tags')) {
            $query->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('discussion_tag')
                ->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
                ->whereColumn('discussion_tag.discussion_id', 'discussions.id')
                ->where('tags.is_hidden', true));
        }

        return $query;
    }

    /** 注册日期、"全部标记为已读"和时限三者中最新的日期。 */
    private function newSince(User $actor): Carbon
    {
        $candidates = array_filter([
            $actor->joined_at ? Carbon::parse($actor->joined_at) : null,
            $actor->marked_all_as_read_at ? Carbon::parse($actor->marked_all_as_read_at) : null,
            $this->settings->newDays() > 0 ? Carbon::now()->subDays($this->settings->newDays()) : null,
        ]);

        return $candidates ? max($candidates) : Carbon::createFromTimestamp(0);
    }
}
