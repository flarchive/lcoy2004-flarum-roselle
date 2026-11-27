/*
 * Discourse 编辑器（composer）的卡片：主卡片标题栏的总开关以及
 * 各项功能。这些键是 `lcoy.composer_*`，在
 * extend/composer.php 中注册——默认全部开启。草稿和 #标签
 * 依赖总开关：关闭它后，它们的卡片会消失。
 */
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.composer';

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`lcoy.composer_${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const cards: CardDef[] = [
  {
    id: 'composer',
    group: 'composer',
    icon: 'fas fa-pen-to-square',
    title: () => trans(`${KEY}.section_editor`, 'Discourse 编辑器'),
    description: () => trans(`${KEY}.enabled_help`, '总开关：关闭后，编辑器回到 Flarum 原版，不启用下面任何功能。'),
    keywords: '编辑器 composer 预览 preview 并排 split 相似 similar 关联 linked 回复 主题',
    master: 'lcoy.composer_enabled',
    body: () => (
      <>
        {toggle('preview', '并排预览', '在桌面端，编辑器足够高时，格式化后的帖子会显示在编辑器右侧。任何人都可以用页脚的按钮将其隐藏。')}
        {toggle('similar', '相似讨论', '撰写新讨论标题时（三个词以上），会显示「你的讨论与以下内容相似…」，最多列出五条相关讨论。')}
        {toggle(
          'linked_topic',
          '将回复作为关联讨论',
          '在回复编辑器中，「↩ ▾」菜单会把这条回复变成一个带有相同内容、指回原讨论的链接以及相同标签的新讨论。'
        )}
      </>
    ),
  },
  {
    id: 'drafts',
    group: 'composer',
    icon: 'fas fa-pen-ruler',
    title: () => trans(`${KEY}.section_drafts`, '草稿'),
    description: () =>
      trans(
        `${KEY}.drafts_help`,
        '安装 FoF Drafts 扩展后，主题会以 Discourse 的方式显示草稿：新讨论和回复会自动保存，回复讨论时会恢复它的草稿，带内容关闭时会询问是放弃还是保留，而「发起讨论」按钮会多出一个带列表的 ⌄。'
      ),
    keywords: '草稿 存草稿 drafts 保存 save 自动 automatic autosave fof',
    master: 'lcoy.composer_drafts',
    dependsOn: 'lcoy.composer_enabled',
    // 草稿属于 fof/drafts：没有它，主题无处保存草稿。
    extensions: ['fof-drafts'],
    body: () => (
      <p className="helpText">{trans(`${KEY}.drafts_note`, '草稿由 fof/drafts 保存（drafts 表），权限和定时保存也由它负责。编辑帖子没有草稿。')}</p>
    ),
  },
  {
    id: 'hashtags',
    group: 'composer',
    icon: 'fas fa-hashtag',
    title: () => trans(`${KEY}.section_hashtags`, '#tag'),
    description: () =>
      trans(
        `${KEY}.hashtags_help`,
        '在编辑器中输入 # 会提示标签并插入指向它们的链接；在帖子中，这些链接（以及 Mentions 扩展的标签提及）会变成带标签图标的胶囊。'
      ),
    keywords: '话题标签 hashtag # 分类 标签 tag link 自动补全 autocomplete 胶囊',
    master: 'lcoy.composer_hashtags',
    dependsOn: 'lcoy.composer_enabled',
    extensions: ['flarum-tags'],
    body: () =>
      isExtensionEnabled('flarum-mentions') ? (
        <AdminNotice>
          {trans(
            `${KEY}.hashtags_mentions_notice`,
            '启用 Mentions 扩展后，编辑器中的 # 归它所有（标签提及）；主题只负责把提及绘制成 Discourse 风格的话题标签。'
          )}
        </AdminNotice>
      ) : null,
  },
];

export default cards;
