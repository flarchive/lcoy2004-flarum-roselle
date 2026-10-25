/*
 * “额外”功能的论坛 extenders：搜索页面的路由。
 */
import Extend from 'flarum/common/extenders';

import { SEARCH_ROUTE } from './search/route';

// 页面位于独立 chunk 中，仅在路由打开时加载。
const SearchPage = () => import('./search/SearchPage');

export default [
  new Extend.Routes() //
    .add(SEARCH_ROUTE, '/search', SearchPage),
];
