/*
 * 主题中缺失的 Discourse 功能与行为（gaps）：代码块按钮、标题锚点、
 * 可展开表格、毛玻璃剧透、提及卡片、帖子快捷键、阅读状态
 *（小圆点和“最后访问”）、时间线中的“返回”、头部可编辑标题、
 * 分享窗口、列表中的“最后访问”和“忽略”，以及侧栏的新链接。
 *
 * lightbox 不在这里：放大图片由 fof/photoswipe 负责。
 *
 * 每个功能都在执行时检查自己的配置，因此始终全部安装，在后台关闭后
 * 会自动消失。
 */
import app from 'flarum/forum/app';

import installCookedDecorators from './cooked/decorate';
import installMentionCards from './cooked/mentions';
import installGapShortcuts from './shortcuts';
import installReadState from './topic/readState';
import installTimelineBack from './topic/timelineBack';
import installTitleEditor from './topic/titleEditor';
import installLastVisit from './list/lastVisit';
import installDismiss from './list/dismiss';
import installSidebarGaps from './sidebar';
import installSidebarHome from './sidebarHome';
import installCategoryNotifications from './integrations/categoryNotifications';
import installGapNotifications from './backend/notifications';

let installed = false;

export function installGaps(): void {
  installMentionCards();
  installGapShortcuts();
  installLastVisit();
  installGapNotifications();

  // 与主题的 topic 一样在 beforeMount：最后注册的 extend 最后运行，
  // 能看到其他扩展和区域放进去的内容。保持幂等，重复调用也不会叠加。
  app.beforeMount(() => {
    if (installed) return;
    installed = true;

    installCookedDecorators();
    installReadState();
    installTimelineBack();
    installTitleEditor();
    installDismiss();
    installSidebarGaps();
    installSidebarHome();
    installCategoryNotifications();
  });
}

export default installGaps;
