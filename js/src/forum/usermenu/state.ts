/*
 * 用户菜单的状态：打开或关闭、当前标签页以及打开时所处的路由。
 * 放在组件之外，因为头像按钮、面板和全局监听器（Esc、点击外部）
 * 需要读写同一个值——也因为切换页面时头部可能被从头重绘。
 */
import app from 'flarum/forum/app';

export const DEFAULT_TAB = 'all-notifications';

class UserMenuState {
  open = false;
  tab: string = DEFAULT_TAB;

  /** 打开时的路由：导航时菜单关闭，与 Discourse 一致。 */
  route: string | null = null;

  /** 仅在关闭者是键盘时才把焦点还给头像。 */
  restoreFocus = false;

  show(): void {
    this.open = true;
    // Discourse 总是在“所有通知”中重新打开。
    this.tab = DEFAULT_TAB;
    this.route = m.route.get();

    // 与核心的 NotificationsDropdown 一致：加载列表会清零新通知计数
    //（头像上的数字）。请求已经显示过错误。
    Promise.resolve(app.notifications.load()).catch(() => {});
  }

  close(restoreFocus = false): void {
    if (!this.open) return;

    this.open = false;
    this.restoreFocus = restoreFocus;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }
}

export const userMenu = new UserMenuState();
