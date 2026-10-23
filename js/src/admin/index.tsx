/*
 * 后台的主题面板。
 *
 * 卡片位于分组（外观 · 页头与侧边栏 · 列表 ·
 * 主题 · 编辑器与搜索 · 个人资料与用户 · 社区 · 审核 ·
 * 集成）中，按浏览论坛的顺序排列。最后两个只在
 * “更多选项”下显示。每个
 * 功能都是一张卡片，标题栏带开关；关闭后内容
 * 消失，依赖它的卡片和选项也会消失（见
 * components/SettingsPanel 和 util: registerDeps/isOn）。
 *
 * 基础主题的卡片在 ./cards/core，带后端的功能在
 * ./features/*。新卡片 = 这些列表中的一项，带唯一的 `id`；
 * 组内位置由下方的 ORDER 决定（不在其中的
 * 会放到组末尾）。键和默认值来自 extend.php 的
 * `$forumSettings` 表以及 extend/<功能>.php。
 */
import normalizeRevManifest from '../common/revManifest';
import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { override } from 'flarum/common/extend';

import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import { lazyComponent } from '../forum/utils/lazy';

const EXTENSION_ID = 'lcoy-roselle';

/** 每个组内卡片的顺序——从最显眼到最具体。 */
const Panel = lazyComponent(
  () => import('./panel').then((mod) => mod.default),
  () => <LoadingIndicator />
);

// 所有控件都会自动保存：原生“保存”按钮只会让人困惑。
override(ExtensionPage.prototype, 'submitButton', function (this: ExtensionPage, original: () => any) {
  if (this.extension?.id === EXTENSION_ID) return null;

  return original();
});

app.initializers.add(EXTENSION_ID, () => {
  // 在任何 chunk 之前：Windows 上的修订键（见该文件）。
  normalizeRevManifest();
  // 注册表中只有一个条目：外壳负责绘制分组和卡片。
  app.registry.for(EXTENSION_ID).registerSetting(() => m(Panel), 100);
});
