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

namespace Lcoy\Roselle\Topic\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Http\SlugManager;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * Os participantes de uma discussão para a coluna de avatares da lista: o
 * autor primeiro, depois quem respondeu por último, no máximo cinco — quatro
 * vão à vista e o quinto só serve para o "+" saber que há mais gente.
 *
 * Vai como atributo enxuto (id, nome, slug e avatar) e não como relação de
 * `users`: cada usuário incluído viraria um recurso inteiro, e as extensões
 * (emblemas, ranking, grupos, termos) fariam 2 a 4 consultas por pessoa — 20
 * linhas de lista passavam de 45 para ~250 consultas.
 *
 * A lista inteira é resolvida em duas consultas por página: o Index chama
 * {@see prefetch()} antes de serializar, e o getter só lê o mapa.
 */
final class DiscussionParticipantsField
{
    /** Avatares à vista; o quinto (quando existe) vira o "+". */
    private const SHOWN = 4;

    /**
     * Participantes da página atual, por id de discussão. Vive só na requisição
     * (o PHP reinicia o estado a cada uma), como os buffers do próprio core.
     *
     * @var array<int, User[]>|null
     */
    private static ?array $page = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly SlugManager $slugs
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaParticipants')
                // Na página do tópico a lista de avatares não existe.
                ->visible(fn (Discussion $discussion, Context $context): bool => ! $context->showing(DiscussionResource::class))
                ->get(fn (Discussion $discussion): array => array_map(
                    fn (User $user): array => $this->shrink($user),
                    self::forDiscussion($discussion)
                )),
        ];
    }

    /**
     * Preenche o mapa da página: todos os participantes de todas as discussões
     * em duas consultas (posts agrupados + usuários), em vez de duas por linha.
     *
     * @param iterable<mixed> $models
     */
    public function prefetch(iterable $models): void
    {
        $discussions = [];

        foreach ($models as $model) {
            if ($model instanceof Discussion && $model->id !== null) {
                $discussions[(int) $model->id] = $model;
            }
        }

        self::$page = [];

        if ($discussions === []) {
            return;
        }

        // Uma linha por (discussão, autor do post); o MAX dá a ordem de quem
        // respondeu por último. Fica no banco o trabalho de agrupar, não no PHP.
        // O trecho cru não passa pelo prefixo de tabelas do Flarum: o nome
        // completo vai escrito à mão.
        $posts = $this->db->getTablePrefix().'posts';

        $rows = $this->db->table('posts')
            ->selectRaw("{$posts}.discussion_id as discussion_id, {$posts}.user_id as user_id, MAX({$posts}.id) as last_post_id")
            ->whereIn('posts.discussion_id', array_keys($discussions))
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false)
            ->whereNull('posts.hidden_at')
            ->whereNotNull('posts.user_id')
            ->groupBy('posts.discussion_id', 'posts.user_id')
            ->get();

        /** @var array<int, array<int, int>> $ultimoPost user_id => último post */
        $ultimoPost = [];

        foreach ($rows as $row) {
            $ultimoPost[(int) $row->discussion_id][(int) $row->user_id] = (int) $row->last_post_id;
        }

        // Os ids que interessam, por discussão: o autor à frente e os demais
        // por ordem do último post, no máximo cinco.
        /** @var array<int, int[]> $idsPorDiscussao */
        $idsPorDiscussao = [];
        $todosOsIds = [];

        foreach ($discussions as $id => $discussion) {
            $authorId = $discussion->user_id !== null ? (int) $discussion->user_id : null;
            $outros = $ultimoPost[$id] ?? [];

            if ($authorId !== null) {
                unset($outros[$authorId]);
            }

            arsort($outros);

            $ids = array_slice(array_keys($outros), 0, $authorId !== null ? self::SHOWN : self::SHOWN + 1);

            if ($authorId !== null) {
                array_unshift($ids, $authorId);
            }

            $idsPorDiscussao[$id] = $ids;
            $todosOsIds = array_merge($todosOsIds, $ids);
        }

        $users = $todosOsIds === []
            ? []
            : User::query()->whereIn('id', array_values(array_unique($todosOsIds)))->get()->keyBy('id');

        foreach ($idsPorDiscussao as $id => $ids) {
            self::$page[$id] = array_values(array_filter(array_map(
                static fn (int $userId): ?User => $users->get($userId),
                $ids
            )));
        }
    }

    /**
     * A lista da página, ou — fora do Index — a consulta avulsa daquela discussão.
     *
     * @return User[]
     */
    private static function forDiscussion(Discussion $discussion): array
    {
        $id = (int) $discussion->id;

        if (self::$page !== null && array_key_exists($id, self::$page)) {
            return self::$page[$id];
        }

        return resolve(self::class)->queryOne($discussion);
    }

    /**
     * Só o que o avatar da lista desenha.
     *
     * @return array{id: string, username: string, displayName: string, slug: string, avatarUrl: string|null, avatarSrcset: string|null}
     */
    private function shrink(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'username' => (string) $user->username,
            // Mesmo fallback do modelo do core: sem nome de exibição, o
            // username é o que aparece.
            'displayName' => (string) ($user->display_name ?: $user->username),
            'slug' => $this->slugs->forResource(User::class)->toSlug($user),
            'avatarUrl' => $user->avatar_url,
            'avatarSrcset' => $user->avatar_srcset,
        ];
    }

    /**
     * @return User[]
     */
    private function queryOne(Discussion $discussion): array
    {
        $author = $discussion->user;

        // O `MAX(...)` vai em SQL cru, e o Flarum prefixa as tabelas na
        // compilação: o nome aqui precisa do prefixo da conexão.
        $latest = 'MAX('.$this->db->getTablePrefix().'posts.id) DESC';

        $others = User::query()
            ->select('users.*')
            ->join('posts', 'posts.user_id', '=', 'users.id')
            ->where('posts.discussion_id', $discussion->id)
            ->where('posts.type', 'comment')
            ->where('posts.is_private', false)
            ->whereNull('posts.hidden_at')
            ->when($author, fn ($query) => $query->where('users.id', '!=', $author->id))
            ->groupBy('users.id')
            ->orderByRaw($latest)
            ->limit($author ? self::SHOWN : self::SHOWN + 1)
            ->get()
            ->all();

        return $author ? array_merge([$author], $others) : $others;
    }
}
