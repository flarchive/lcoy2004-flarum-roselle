/*
 * 主题自带、采用 Discourse 格式的 gambits：
 *
 * - `em:title`（`in:title`）：文本仅在主题标题中匹配。
 * - `em:liked`（`in:likes`）：包含我点赞过的帖子的主题。
 * - `em:bookmarks`（`in:bookmarks`）：包含我收藏过的帖子的主题。
 * - `min-posts:5`（`min-posts:5`）：至少包含 5 条帖子的主题。
 *
 * 它们注册到核心的 GambitManager 中，因此适用于任何主题搜索——
 * 包括输入时给出建议的弹窗——搜索页面也借此把高级筛选条件存入
 * 查询本身，与 Discourse 的做法一致（"horizon in:title min_posts:5"）。
 */
import app from 'flarum/forum/app';
import { BooleanGambit, KeyValueGambit } from 'flarum/common/query/IGambit';

import { forumBool, isExtensionEnabled, t } from '../../utils/settings';

/** 主题自带的布尔型 gambits 位于 `em:`/`in:` 组，而非核心的 `é:`（`is:`）组。 */
abstract class InGambit extends BooleanGambit {
  groupKey(): string {
    return t('extras.gambits.in_group');
  }

  // 每次搜索时读取（而非注册时）：initializer 运行时论坛配置
  // 尚不存在。
  enabled(): boolean {
    return gambitsEnabled();
  }
}

/** gambits 属于高级搜索：后者关闭时它们也随之消失。 */
function gambitsEnabled(): boolean {
  return forumBool('lcoySearchPageEnabled', true);
}

export class InTitleGambit extends InGambit {
  key(): string {
    return t('extras.gambits.title_key');
  }

  filterKey(): string {
    return 'lcoyInTitle';
  }
}

export class LikedGambit extends InGambit {
  key(): string {
    return t('extras.gambits.likes_key');
  }

  filterKey(): string {
    return 'lcoyLiked';
  }

  // 服务端筛选仅在启用 flarum/likes 时存在，且仅在登录后有意义。
  enabled(): boolean {
    return gambitsEnabled() && !!app.session.user && isExtensionEnabled('flarum-likes');
  }
}

export class BookmarkedGambit extends InGambit {
  key(): string {
    return t('extras.gambits.bookmarks_key');
  }

  filterKey(): string {
    return 'lcoyBookmarked';
  }

  // 书签是主题的另一项功能，可能已关闭。
  enabled(): boolean {
    return gambitsEnabled() && !!app.session.user && forumBool('lcoyBookmarksEnabled', false);
  }
}

export class MinPostsGambit extends KeyValueGambit {
  key(): string {
    return t('extras.gambits.min_posts_key');
  }

  hint(): string {
    return t('extras.gambits.min_posts_hint');
  }

  valuePattern(): string {
    return '(\\d+)';
  }

  filterKey(): string {
    return 'lcoyMinPosts';
  }

  enabled(): boolean {
    return gambitsEnabled();
  }
}

export default function installGambits(): void {
  // 与核心 Search extender 所做相同，但不依赖主入口额外注册
  // 一个 extender：该列表在每次搜索时读取。
  const registry = app.search.gambits.gambits;

  registry.discussions ||= [];
  registry.discussions.push(InTitleGambit, LikedGambit, BookmarkedGambit, MinPostsGambit);
}
