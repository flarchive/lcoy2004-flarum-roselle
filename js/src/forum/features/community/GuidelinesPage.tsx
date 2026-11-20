import { guidelinesEnabled } from './AboutNav';
import RulesPage from './RulesPage';
import { t } from '../../utils/settings';

/**
 * “准则”（/guidelines，/faq 为别名）：在管理后台选定的
 * fof/pages 页面，或主题自带文本，采用规则页布局。
 */
export default class GuidelinesPage extends RulesPage {
  title(): string {
    return t('community.guidelines.title');
  }

  className(): string {
    return 'LcoyGuidelinesPage';
  }

  enabled(): boolean {
    return guidelinesEnabled();
  }

  endpoint(): string {
    return '/lcoy-guidelines';
  }

  activeTab(): string {
    return 'lcoy.guidelines';
  }
}
