/*
 * Discourse 动效：顶部加载条、提示条、菜单关闭、
 * 图标按钮提示、“正在输入”的省略号，以及
 * “链接已复制”的反馈。纯 CSS 的部分（打开、高亮、加载指示器、
 * 骨架屏、聚焦）位于 `less/forum/Motion.less`。
 */
import installLoadingSlider from './loadingSlider';
import installToasts from './toasts';
import installMenus from './menus';
import installTooltips from './tooltips';
import installTyping from './typing';
import installFeedback from './feedback';

export default function installMotion() {
  // 配置只在启动后才存在（`app.forum`）：每个模块在行动时
  // 读取它，绝不在这里读取。
  installLoadingSlider();

  installToasts();
  installMenus();
  installTooltips();
  installTyping();
  installFeedback();
}
