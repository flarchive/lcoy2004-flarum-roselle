/*
 * 点击作者头像和名字会打开用户卡片，与 Discourse 一致，
 * 取代核心中鼠标悬停时出现的卡片。
 */
import { override } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';

import { openUserCard } from './components/UserCardPopover';
import { topicSettings } from './ui';

const TRIGGERS = '.Post-side .Post-avatar, .PostUser-name a';

export default function installUserCard(): void {
  override(CommentPost.prototype, 'listenForCard', function (this: any, original: () => void) {
    if (!topicSettings.userCard()) return original();

    // 在捕获阶段：点击在这里终止，先于头像的 Link 导航到个人资料。
    this.element.addEventListener(
      'click',
      (event: MouseEvent) => {
        const trigger = (event.target as HTMLElement).closest<HTMLElement>(TRIGGERS);

        if (!trigger || !this.element.contains(trigger)) return;

        // Ctrl/Cmd+点击仍然在新标签页打开个人资料。
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const user = this.attrs.post.user();

        if (!user) return;

        event.preventDefault();
        event.stopPropagation();

        // 卡片对齐到侧栏头像；在手机上它被隐藏，
        // 此时以头部头像作为锚点。
        const sideAvatar = this.element.querySelector('.Post-side .Post-avatar') as HTMLElement | null;
        const anchor = sideAvatar && sideAvatar.offsetParent !== null ? sideAvatar : trigger;

        openUserCard(user, anchor);
      },
      true
    );
  });
}
