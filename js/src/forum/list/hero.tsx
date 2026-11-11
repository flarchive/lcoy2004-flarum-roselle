/*
 * 首页顶部。没有标签时：Horizon 的欢迎横幅（或
 * 什么也没有）。有标签时：大的分类 hero（或 flarum/tags 的 TagHero）。
 *
 * override 在 flarum/tags 的之后运行（可选依赖，先加载），
 * 因此有标签时 `original()` 已是 TagHero，没有标签时则是
 * 核心的 WelcomeHero。
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';
import { currentTag } from '../utils/tags';
import WelcomeBanner from './WelcomeBanner';
import CategoryHero from './CategoryHero';

export function welcomeBannerVisible(): boolean {
  if (!forumBool('lcoyWelcomeBanner', true)) return false;

  return !(forumBool('lcoyWelcomeBannerGuestsOnly', false) && app.session.user);
}

let installed = false;

export default function installHero(): void {
  override(IndexPage.prototype, 'hero', function (original: () => Mithril.Children) {
    const tag = currentTag();

    if (tag) {
      return forumBool('lcoyCategoryHero', true) ? <CategoryHero model={tag} /> : original();
    }

    // 标签仍在加载中的标签页：先什么都不显示，
    // 而不是闪现欢迎横幅。
    if (app.search.state.params().tags) return null;

    // 在搜索中横幅会造成干扰：结果才是重点。
    if (app.search.state.params().q) return null;

    return welcomeBannerVisible() ? <WelcomeBanner /> : null;
  });

  // "关注"（flarum/subscriptions）：fof/follow-tags 在自己的 override 中
  // 把 hero 换成灰色条带，该 override 在此之后运行。在 beforeMount 中
  // 主题排在最后，页面获得与分类相同的顶部。
  app.beforeMount(() => {
    if (installed) return;
    installed = true;

    override(IndexPage.prototype, 'hero', function (original: () => Mithril.Children) {
      if (app.current.get('routeName') !== 'following') return original();

      return (
        <header className="Hero LcoyCategoryHero LcoyFollowingHero">
          <div className="container">
            <h1 className="LcoyCategoryHero-title">{app.translator.trans('flarum-subscriptions.forum.index.following_link')}</h1>
          </div>
        </header>
      );
    });
  });
}
