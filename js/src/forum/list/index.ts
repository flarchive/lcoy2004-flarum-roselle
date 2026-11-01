/*
 * Discourse 的主题列表：新的排序方式、按列显示的行、
 * 页眉、导航栏、首页 hero 以及分类页面。
 * 在论坛的 initializer 中调用一次。
 */
import installSorts from './sorts';
import installListItem from './listItem';
import installListHeader from './listHeader';
import installNavigation from './navigation';
import installHero from './hero';
import installCategoriesPage from './categoriesPage';
import installInfiniteScroll from './infiniteScroll';
import installRoutes from './routes';

export function installList(): void {
  installRoutes();
  installSorts();
  installListItem();
  installListHeader();
  installNavigation();
  installHero();
  installCategoriesPage();
  installInfiniteScroll();
}

export default installList;
