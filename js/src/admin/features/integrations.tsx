/*
 * 主题适配的第三方扩展（js/src/forum/thirdparty）卡片。
 * 每项都只有在启用对应扩展后才生效：没有它时卡片会被锁定，
 * 并显示“需要 {name} 扩展”。这些键是 extend.php 中的 `lcoy.thirdparty_*`。
 */
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.integrations';

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const cards: CardDef[] = [
  {
    id: 'thirdparty-solved',
    group: 'integrations',
    icon: 'far fa-square-check',
    title: () => trans(`${KEY}.solved_label`, '已采纳的解决方案'),
    description: help('solved', '帖子操作栏中的「✓ 解决方案」，以及首帖正下方的已采纳回答，效果与 discourse-solved 一致。'),
    keywords: '解决方案 solved 最佳答案 best answer 已采纳 accepted fof',
    master: 'lcoy.thirdparty_solved',
    extensions: ['fof-best-answer'],
  },
  {
    id: 'thirdparty-reactions',
    group: 'integrations',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.reactions_label`, '表情回应'),
    description: help('reactions', '帖子操作栏中的表情汇总，效果与 discourse-reactions 一致。'),
    keywords: '表情回应 reactions emoji 点赞 like fof',
    master: 'lcoy.thirdparty_reactions',
    extensions: ['fof-reactions'],
  },
  {
    id: 'thirdparty-polls',
    group: 'integrations',
    icon: 'fas fa-square-poll-horizontal',
    title: () => trans(`${KEY}.polls_label`, '投票'),
    description: help('polls', '采用 Discourse 投票栅格样式的投票：结果条，以及旁边醒目的大号票数。'),
    keywords: '投票 polls 表决 票数 votes fof',
    master: 'lcoy.thirdparty_polls',
    extensions: ['fof-polls'],
  },
  {
    id: 'thirdparty-links',
    group: 'integrations',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.links_sidebar_label`, '侧栏中的链接'),
    description: help('links_sidebar', 'FoF Links 从页头移到侧栏的一个区块中，类似 Discourse 的自定义链接。'),
    keywords: '链接 links fof 侧栏 sidebar 页头 header 导航',
    master: 'lcoy.thirdparty_links_sidebar',
    dependsOn: 'lcoy.sidebar_enabled',
    extensions: ['fof-links'],
  },
  {
    id: 'thirdparty-upload',
    group: 'integrations',
    icon: 'fas fa-cloud-arrow-up',
    title: () => trans(`${KEY}.upload_progress_label`, '上传进度'),
    description: help('upload_progress', '通过 FoF Upload 发送文件时，编辑器中显示的「正在上传…」进度条，与 Discourse 一致。'),
    keywords: 'upload 上传 发送文件 file 进度 progress 进度条 fof',
    master: 'lcoy.thirdparty_upload_progress',
    extensions: ['fof-upload'],
  },
  {
    id: 'thirdparty-thumbnails',
    group: 'integrations',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.thumbnails_label`, '列表中的缩略图'),
    description: help('thumbnails', '在讨论列表中于标题旁显示 FoF Discussion Thumbnail 的图片，也就是 Discourse 显示自带缩略图的位置。'),
    keywords: '缩略图 thumbnail 图片 image 列表 list 主题 fof',
    master: 'lcoy.thirdparty_thumbnails',
    extensions: ['fof-discussion-thumbnail'],
  },
  {
    id: 'thirdparty-profile-cover',
    group: 'integrations',
    icon: 'fas fa-panorama',
    title: () => trans(`${KEY}.profile_cover_label`, '个人主页封面（forumaker/profile-cover）'),
    description: help(
      'profile_cover',
      '用该扩展的封面取代主题自带的封面：显示在个人主页的横幅中、用户卡片后方（有缩略图时则作为缩略图），以及在其编辑器中选定的位置——该编辑器可从个人主页的「…」菜单和「设置」中打开。主题自带的图片仍会保留，关闭此开关后即可恢复使用。'
    ),
    keywords: '封面 cover 个人主页 profile 图片 image 背景 background 卡片 card forumaker 位置 position 缩略图 thumbnail',
    master: 'lcoy.thirdparty_profile_cover',
    extensions: ['forumaker-profile-cover'],
  },
];

export default cards;
