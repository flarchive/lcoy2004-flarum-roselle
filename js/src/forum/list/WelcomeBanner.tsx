/*
 * Horizon 的欢迎横幅：大标题、管理员的欢迎
 * 消息，以及位于页面淡色背景上的胶囊形搜索框。
 *
 * 继承核心的 Hero 以保留 `.Hero` 类 —— IndexPage 会测量它的
 * 高度，以便把读者带回列表中的同一位置。
 */
import app from 'flarum/forum/app';
import Hero from 'flarum/forum/components/Hero';
import GlobalSearch from 'flarum/forum/components/GlobalSearch';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';

export default class WelcomeBanner extends Hero {
  className(): string {
    return 'LcoyWelcome';
  }

  bodyItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const title = app.forum.attribute<string>('welcomeTitle')?.trim() || app.forum.attribute<string>('title');
    const message = app.forum.attribute<string>('welcomeMessage')?.trim();

    items.add(
      'text',
      <div className="LcoyWelcome-text">
        <h1 className="LcoyWelcome-title">{title}</h1>
        {/* 消息来自管理员（外观），接受 HTML，与核心的 WelcomeHero 相同。 */}
        {message ? <div className="LcoyWelcome-message">{m.trust(message)}</div> : null}
      </div>,
      100
    );

    if (forumBool('lcoyWelcomeBannerSearch', true)) {
      items.add(
        'search',
        <div className="LcoyWelcome-search">
          <GlobalSearch state={app.search.state} />
        </div>,
        50
      );
    }

    return items;
  }
}
