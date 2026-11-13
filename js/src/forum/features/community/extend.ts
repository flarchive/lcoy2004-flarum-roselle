import Extend from 'flarum/common/extenders';
import Group from 'flarum/common/models/Group';

// 按需加载的页面（独立 chunk）：不增加首次加载负担。
const AboutPage = () => import('./AboutPage');
const GuidelinesPage = () => import('./GuidelinesPage');
const AboutExtraPage = () => import('./AboutExtraPage');
const GroupsPage = () => import('./GroupsPage');
const GroupPage = () => import('./GroupPage');

/*
 * 这些路由始终存在：extenders 在论坛获知配置之前就已运行。
 * 功能关闭时，服务端对通过地址直接访问的用户返回 404，
 * 链接会隐藏，页面只显示一条提示。
 */
// avocado 主题的 /team（后端路由 `avocado-team`）：在 Lcoy 中启用
// Wardrobe 后，avocado 的 JS 不会加载，该页面曾显示空白。此处让它
// 打开“关于”页面（其中列出团队）。若 avocado 的 JS 存在，
// 该路由归它管理。
const avocadoTeam = new Extend.Routes().add('avocado-team', '/team', AboutPage);
const avocadoTeamRoute = {
  extend(app: any, extension: any) {
    if ('ramon-avocado' in flarum.extensions) return;
    avocadoTeam.extend(app, extension);
  },
};

export default [
  avocadoTeamRoute,
  new Extend.Routes()
    .add('lcoy.about', '/about', AboutPage)
    .add('lcoy.guidelines', '/guidelines', GuidelinesPage)
    .add('lcoy.faq', '/faq', GuidelinesPage)
    // 管理员放在“关于”区域中的 fof/pages 页面（/about/3-slug）。
    .add('lcoy.about_page', '/about/:page', AboutExtraPage)
    .add('lcoy.groups', '/g', GroupsPage)
    .add('lcoy.group', '/g/:name', GroupPage),

  new Extend.Model(Group).attribute<number>('lcoyMemberCount'),
];
