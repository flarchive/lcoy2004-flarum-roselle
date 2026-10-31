/*
 * Discourse 的统计：浏览量、“新帖 (N)”/“未读 (N)”以及个人资料活跃度。
 * 后端负责全部计数（extend/stats.php）；此处是显示计数的导航以及
 * 阅读时长记录。
 */
import installNavigation from './navigation';
import installReadTracker from './readTracker';

export function installStats(): void {
  installNavigation();
  installReadTracker();
}

export default installStats;
