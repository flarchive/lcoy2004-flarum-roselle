/*
 * 用户名后面的图标（例如 ramon/verified 的认证徽章），
 * 如同 Discourse 的 “poster icons”：位于文本行中、与文本同尺寸，
 * 在名称之后、状态表情之前。
 *
 * 主题的各界面（帖子页头、内嵌帖子、“回复”、
 * 卡片、个人主页、用户列表、提及）在名称结束处调用 `userIcons()`；
 * 集成（thirdparty/*）注册要绘制的内容。这样任何界面都不需要
 * 导入可能已关闭的扩展。
 */
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

/** 名称出现的位置：会改变尺寸以及是否容纳弹出层。 */
export type UserIconContext = 'post' | 'embedded' | 'replyTo' | 'card' | 'profile' | 'directory' | 'mention' | 'menu' | 'list';

type Provider = (user: User, context: UserIconContext) => Mithril.Children;

const providers: { key: string; priority: number; provider: Provider }[] = [];

/** 注册一个图标；优先级越高越靠前，如同 ItemList。 */
export function registerUserIcon(key: string, provider: Provider, priority = 0): void {
  if (providers.some((entry) => entry.key === key)) return;

  providers.push({ key, priority, provider });
  providers.sort((a, b) => b.priority - a.priority);
}

/**
 * 将某个人的图标放进一个 <span>（或什么都不放）：单个 vnode 不会影响
 * 调用方带 key 的 Mithril 列表。
 */
export function userIcons(user: User | null | undefined, context: UserIconContext): Mithril.Children {
  if (!user || !providers.length) return null;

  const icons: Mithril.Children[] = [];

  for (const { provider } of providers) {
    try {
      const icon = provider(user, context);

      if (icon) icons.push(icon);
    } catch {
      // 出错的图标（例如新版本扩展中的）不能让帖子或整个卡片
      // 崩溃：只是不显示它。
    }
  }

  return icons.length ? <span className={`LcoyUserIcons LcoyUserIcons--${context}`}>{icons}</span> : null;
}
