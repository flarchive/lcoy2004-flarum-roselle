/*
 * Discourse 的“额外”功能：高级搜索页面、批量选择、
 * 按时间段的“最佳”、文本大小以及打印主题。
 *
 * 每项在渲染时检查自身配置（`lcoy*Enabled`）——initializer 阶段
 * 论坛尚未加载配置——因此始终全部安装，并在关闭时自动消失。
 */
import installSearchPage from './search';
import installBulkSelect from './bulk';
import installTopPeriods from './topPeriods';
import installTextSize from './textSize';
import installPrint from './print';

export function installExtras(): void {
  installSearchPage();
  installBulkSelect();
  installTopPeriods();
  installTextSize();
  installPrint();
}

export default installExtras;
