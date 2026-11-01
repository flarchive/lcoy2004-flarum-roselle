import app from 'flarum/forum/app';
import normalizeRevManifest from '../common/revManifest';

import installIcons from './icons';
import installPreload from './utils/preload';
import installShell from './shell/installShell';
import installList from './list';
import installUser from './user';
import installTopic from './topic';
import installCommunity from './features/community';
import installStats from './features/stats';
import installBookmarks from './features/bookmarks';
import installComposer from './features/composer';
import installExtras from './features/extras';
import installUserMenu from './usermenu';
import installReview from './review';
import installComposerShell from './composer/installComposerShell';
import installGaps from './gaps';
import installMotion from './motion';
import installThirdParty from './thirdparty';
import installSearchMenu from './search';
import installAuth from './features/auth';
import installActionTooltips from './topic/actionTooltips';

import communityExtend from './features/community/extend';
import bookmarksExtend from './features/bookmarks/extend';
import extrasExtend from './features/extras/extend';
import gapsExtend from './gaps/extend';
import userMenuExtend from './usermenu/extend';

// 带后端功能的模型与路由。每个功能自行决定是否出现（由服务器序列化的配置
// 决定），所以始终注册路由不会有副作用。
export const extend = [...communityExtend, ...bookmarksExtend, ...extrasExtend, ...gapsExtend, ...userMenuExtend];

app.initializers.add('lcoy-roselle', () => {
  // 早于任何 chunk：处理 Windows 上的修订号键（见该文件）。
  normalizeRevManifest();
  // 最先执行：启动时就要数据的页面能直接拿到现成的响应。
  installPreload();
  installIcons();
  // 基础主题：外壳、列表、个人主页和主题页。
  installShell();
  installList();
  installUser();
  installTopic();

  // 带后端的功能。互相扩展时顺序很重要：社区功能会替换个人主页的一项，
  // 统计会扩展列表导航和侧栏。
  installCommunity();
  installStats();
  installBookmarks();
  installComposer();
  installComposerShell();
  installExtras();
  installUserMenu();
  // /flags 页面上 Discourse 风格的审核队列（flarum/flags 与 approval）。
  installReview();

  // 补齐的 Discourse 功能与行为（gaps/）。
  installGaps();

  // 动画、toast、提示与加载效果（motion/）。
  installMotion();

  // 第三方扩展（FoF）的 Discourse 风格外观（thirdparty/）。
  installThirdParty();

  // 页头与横幅中的 Discourse 风格搜索菜单（search/）。
  installSearchMenu();

  // 独立页面上的登录与注册（/login、/signup）。
  installAuth();

  // 帖子操作栏中纯图标按钮的提示：放在最后，才能看到所有功能与扩展的按钮。
  installActionTooltips();
});
