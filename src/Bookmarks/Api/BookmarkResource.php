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

namespace Lcoy\Roselle\Bookmarks\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Lcoy\Roselle\Bookmarks\Bookmark;
use Lcoy\Roselle\Bookmarks\BookmarksFeature;
use Tobyz\JsonApiServer\Context as OriginalContext;
use Tobyz\JsonApiServer\Pagination\OffsetPagination;
use Tobyz\JsonApiServer\Pagination\Pagination;

/**
 * `/api/bookmarks`：当前操作者的书签。
 *
 * - GET 列表（过滤器 `q` 和 `reminder`，排序 `createdAt`、`updatedAt` 和
 *   `reminderAt`），并包含帖子、主题和作者。
 * - POST 标记一个帖子；PATCH 修改名称和提醒；DELETE 取消标记。
 *
 * 作用域已把一切限制在所有者范围内（ScopeBookmarkVisibility）：访问他人
 * 的书签返回 404 而非 403，以免确认其存在。
 *
 * @extends AbstractDatabaseResource<Bookmark>
 */
final class BookmarkResource extends AbstractDatabaseResource
{
    /** 允许的排序 => 列。列表以 id 收尾，使分页既不跳过也不重复。 */
    private const SORT_COLUMNS = [
        'createdAt' => 'lcoy_bookmarks.created_at',
        'updatedAt' => 'lcoy_bookmarks.updated_at',
        'reminderAt' => 'lcoy_bookmarks.reminder_at',
    ];

    #[\Override]
    public function type(): string
    {
        return 'bookmarks';
    }

    #[\Override]
    public function model(): string
    {
        return Bookmark::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        // `before` 在找到模型之后、任何写入之前运行：
        // 功能关闭时，一切请求都返回 404。
        $assertEnabled = static fn () => BookmarksFeature::assertEnabled();

        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before($assertEnabled)
                ->defaultInclude(['post', 'post.discussion', 'post.user'])
                ->defaultSort('-createdAt')
                ->paginate(20, 50)
                // 没有 searcher 时，核心会拒绝任何 `filter[...]`；这里的
                // 过滤器足够简单，可以直接放在资源里。
                ->query(function (Builder $query, ?Pagination $pagination, Context $context, array $filters, ?array $sort): Context {
                    $this->applyFilters($query, $context->getActor(), $filters);
                    $this->applySort($query, $sort);

                    if ($pagination instanceof OffsetPagination) {
                        $pagination->apply($query);
                    }

                    return $context->withQuery($query);
                }),
            Endpoint\Show::make()
                ->authenticated()
                ->before($assertEnabled)
                ->defaultInclude(['post', 'post.discussion']),
            Endpoint\Create::make()
                ->authenticated()
                ->before($assertEnabled)
                ->defaultInclude(['post']),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit')
                ->before($assertEnabled)
                ->defaultInclude(['post']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before($assertEnabled),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\Str::make('name')
                ->nullable()
                ->writable()
                ->maxLength(Bookmark::NAME_MAX_LENGTH)
                ->set(static fn (Bookmark $bookmark, ?string $value) => $bookmark->setName($value)),

            Schema\DateTime::make('reminderAt')
                ->nullable()
                ->writable()
                // 过去的提醒永远不会被发送——而 Discourse
                // 也只接受未来的时间。
                ->rule('after:now')
                ->set(static fn (Bookmark $bookmark, ?\DateTimeInterface $value) => $bookmark->setReminder($value)),

            Schema\DateTime::make('remindedAt'),
            Schema\DateTime::make('createdAt'),
            Schema\DateTime::make('updatedAt'),

            Schema\Relationship\ToOne::make('post')
                ->type('posts')
                ->includable()
                ->requiredOnCreate()
                ->writableOnCreate(),
        ];
    }

    #[\Override]
    public function sorts(): array
    {
        return array_map(
            static fn (string $name) => SortColumn::make($name),
            array_keys(self::SORT_COLUMNS)
        );
    }

    /**
     * 书签的所有者始终是标记者本人。再次标记同一个帖子会复用已有的
     * 书签（唯一索引不允许再存在一个），并采用本次传入的名称和提醒——
     * 因此双击不会变成错误。
     */
    #[\Override]
    public function creating(object $model, OriginalContext $context): ?object
    {
        /** @var Context $context */
        $actor = $context->getActor();

        $model->user_id = $actor->id;

        /** @var Bookmark|null $existing */
        $existing = Bookmark::query()
            ->where('user_id', $actor->id)
            ->where('post_id', $model->post_id)
            ->first();

        if (! $existing) {
            return $model;
        }

        if ($model->isDirty('name')) {
            $existing->name = $model->name;
        }

        if ($model->isDirty('reminder_at')) {
            $existing->setReminder($model->reminder_at);
        }

        return $existing;
    }

    /** @param Builder<Bookmark> $query */
    private function applyFilters(Builder $query, User $actor, array $filters): void
    {
        // 只保留操作者仍可见的内容：被隐藏的帖子，或已转入受限分类的主题，
        // 会从列表中消失，但不会删除书签。
        $query->whereHas('post', static fn (Builder $posts) => $posts->whereVisibleTo($actor));

        $term = trim((string) ($filters['q'] ?? ''));

        if ($term !== '') {
            $like = '%'.addcslashes($term, '\\%_').'%';

            $query->where(static function (Builder $query) use ($like) {
                $query->where('lcoy_bookmarks.name', 'like', $like)
                    ->orWhereHas('post', static function (Builder $posts) use ($like) {
                        $posts->where('content', 'like', $like)
                            ->orWhereHas('discussion', static fn (Builder $discussions) => $discussions->where('title', 'like', $like));
                    });
            });
        }

        match ($filters['reminder'] ?? null) {
            'pending' => $query->whereNotNull('lcoy_bookmarks.reminder_at')->whereNull('lcoy_bookmarks.reminded_at'),
            'any' => $query->whereNotNull('lcoy_bookmarks.reminder_at'),
            'none' => $query->whereNull('lcoy_bookmarks.reminder_at'),
            default => null,
        };

        if (isset($filters['discussion'])) {
            $discussionId = (int) $filters['discussion'];

            $query->whereIn(
                'lcoy_bookmarks.post_id',
                Post::query()->select('id')->where('discussion_id', $discussionId)
            );
        }
    }

    /** @param Builder<Bookmark> $query */
    private function applySort(Builder $query, ?array $sort): void
    {
        $direction = 'desc';

        foreach ($sort ?? [] as $name => $direction) {
            if (isset(self::SORT_COLUMNS[$name])) {
                // 空提醒在两种排序方向下都排在最后：按"提醒"
                // 排序是为了查看下一个到期项。
                if ($name === 'reminderAt') {
                    $query->orderByRaw('CASE WHEN '.$query->getQuery()->getGrammar()->wrap('lcoy_bookmarks.reminder_at').' IS NULL THEN 1 ELSE 0 END');
                }

                $query->orderBy(self::SORT_COLUMNS[$name], $direction);
            }
        }

        $query->orderBy('lcoy_bookmarks.id', $direction);
    }
}
