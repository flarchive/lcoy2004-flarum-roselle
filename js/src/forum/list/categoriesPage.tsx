/*
 * Discourse 风格的分类页面：顶部是导航栏，
 * 分类以方框（或表格，取决于管理员设置）显示，下方是
 * 带主题计数的标签。
 *
 * 启用 Discourse 地址后，/categories 就是这个页面，/tags
 * 变成 Discourse 的标签页（"标签"、"按
 * 计数/名称排序" 以及列表）。未启用时，/tags 兼任两者。
 *
 * TagsPage 来自 flarum/tags；仅当该扩展启用时才从模块注册表中
 * 获取，以免主题依赖它。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { categoryBadge, categorySymbol, isTagsEnabled, separateTagsPage, sortTags, tagSymbol, tagUrl, type LcoyTag } from '../utils/tags';
import { shortAge, fullDate } from '../utils/dates';
import ListNavigation from './ListNavigation';

type Layout = 'boxes' | 'list';

function layout(): Layout {
  return app.forum.attribute<string>('lcoyCategoriesLayout') === 'list' ? 'list' : 'boxes';
}

function childrenOf(tag: LcoyTag): LcoyTag[] {
  const children = tag.children();

  return Array.isArray(children) ? sortTags(children.filter(Boolean)) : [];
}

function colorStyle(tag: LcoyTag): Record<string, string> | undefined {
  const color = tag.color();

  return color ? { '--category-color': color } : undefined;
}

function boxesView(categories: LcoyTag[]): Mithril.Children {
  return (
    <ul className="LcoyCategoryBoxes">
      {categories.map((tag) => {
        const children = childrenOf(tag);

        return (
          <li className="LcoyCategoryBox" style={colorStyle(tag)}>
            <h3 className="LcoyCategoryBox-title">
              {/* 标题链接会通过 ::after 延伸到整个方框；
                  子标签的链接位于其上方。 */}
              <Link className="LcoyCategoryBox-link" href={tagUrl(tag)}>
                {categorySymbol(tag)}
                <span className="LcoyCategoryBox-name">{tag.name()}</span>
              </Link>
            </h3>
            {tag.description() && <p className="LcoyCategoryBox-description">{tag.description()}</p>}
            {children.length > 0 && (
              <ul className="LcoyCategoryBox-children">
                {children.map((child) => (
                  <li>{categoryBadge(child)}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const skeletonLine = (width: string) => <span className="LcoySkeleton LcoySkeleton--line" style={{ width }} />;

/** 加载中的方框：名称、两行描述以及子标签一排。 */
function boxesSkeleton(): Mithril.Children {
  return (
    <ul className="LcoyCategoryBoxes LcoyCategoryBoxes--loading" aria-busy="true">
      {['48%', '36%', '56%', '42%', '30%', '52%'].map((width) => (
        <li className="LcoyCategoryBox">
          <h3 className="LcoyCategoryBox-title">{skeletonLine(width)}</h3>
          <p className="LcoyCategoryBox-description">
            {skeletonLine('92%')}
            {skeletonLine('60%')}
          </p>
          <ul className="LcoyCategoryBox-children">
            {['4.5em', '6em', '5em'].map((child) => (
              <li>{skeletonLine(child)}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** 加载中的表格：真实的表头以及带占位条的行。 */
function listSkeleton(): Mithril.Children {
  return (
    <table className="LcoyCategoryTable LcoyCategoryTable--loading" aria-busy="true">
      <thead>
        <tr>
          <th className="LcoyCategoryTable-category">{t('categories.category')}</th>
          <th className="LcoyCategoryTable-topics">{t('categories.topics')}</th>
          <th className="LcoyCategoryTable-latest">{t('categories.latest')}</th>
        </tr>
      </thead>
      <tbody>
        {['30%', '22%', '36%', '26%', '18%'].map((width) => (
          <tr>
            <td className="LcoyCategoryTable-category">
              <h3 className="LcoyCategoryTable-name">{skeletonLine(width)}</h3>
              <p className="LcoyCategoryTable-description">{skeletonLine('70%')}</p>
            </td>
            <td className="LcoyCategoryTable-topics">
              <span className="LcoySkeleton LcoySkeleton--word" style={{ width: '1.5em' }} />
            </td>
            <td className="LcoyCategoryTable-latest">
              <div className="LcoyCategoryTable-latestInner">{skeletonLine('80%')}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function latestView(tag: LcoyTag): Mithril.Children {
  const discussion = tag.lastPostedDiscussion() as Discussion | null | false | undefined;

  if (!discussion) return <span className="LcoyCategoryTable-none">-</span>;

  const date = discussion.lastPostedAt();

  return (
    <div className="LcoyCategoryTable-latestInner">
      <Link className="LcoyCategoryTable-latestTitle" href={app.route.discussion(discussion, discussion.lastPostNumber() ?? undefined)}>
        {discussion.title()}
      </Link>
      {date && (
        <span className="LcoyCategoryTable-latestAge" title={fullDate(date)}>
          {shortAge(date)}
        </span>
      )}
    </div>
  );
}

function listView(categories: LcoyTag[]): Mithril.Children {
  return (
    <table className="LcoyCategoryTable">
      <thead>
        <tr>
          <th className="LcoyCategoryTable-category">{t('categories.category')}</th>
          <th className="LcoyCategoryTable-topics">{t('categories.topics')}</th>
          <th className="LcoyCategoryTable-latest">{t('categories.latest')}</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((tag) => {
          const children = childrenOf(tag);

          return (
            <tr style={colorStyle(tag)}>
              <td className="LcoyCategoryTable-category">
                <h3 className="LcoyCategoryTable-name">
                  <Link href={tagUrl(tag)}>
                    {categorySymbol(tag)}
                    <span>{tag.name()}</span>
                  </Link>
                </h3>
                {tag.description() && <p className="LcoyCategoryTable-description">{tag.description()}</p>}
                {children.length > 0 && <div className="LcoyCategoryTable-children">{children.map((child) => categoryBadge(child))}</div>}
              </td>
              <td className="LcoyCategoryTable-topics">{tag.discussionCount()}</td>
              <td className="LcoyCategoryTable-latest">{latestView(tag)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function tagsView(labels: LcoyTag[], title = t('categories.tags_title')): Mithril.Children {
  return (
    <section className="LcoyTagCloud">
      <h2 className="LcoyTagCloud-title">{title}</h2>
      <ul className="LcoyTagCloud-list">
        {labels.map((tag) => (
          <li className="LcoyTagCloud-item">
            <Link
              className="LcoyTagCloud-tag"
              href={tagUrl(tag)}
              title={tag.description() || undefined}
              style={tag.color() ? { '--tag-color': tag.color() } : undefined}
            >
              {tagSymbol(tag)}
              <span>{tag.name()}</span>
            </Link>
            <span className="LcoyTagCloud-count">x {tag.discussionCount()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 标签页的排序方式；与 Discourse 相同，仅在本次会话中保持。 */
let tagSort: 'count' | 'name' = 'count';

function sortLink(key: 'count' | 'name', label: string): Mithril.Children {
  return (
    <a
      href="#"
      className={classList('LcoyTagsPage-sort', { active: tagSort === key })}
      aria-pressed={tagSort === key ? 'true' : 'false'}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        tagSort = key;
      }}
    >
      {label}
    </a>
  );
}

/** Discourse 的 /tags 页面（`.tags-index`）。 */
function tagsPageView(labels: LcoyTag[]): Mithril.Children {
  const sorted = tagSort === 'name' ? labels.slice().sort((a, b) => a.name().localeCompare(b.name(), undefined, { sensitivity: 'base' })) : labels;

  return (
    <div className="LcoyTagsPage">
      <h2 className="LcoyTagsPage-title">{t('categories.tags_title')}</h2>
      <div className="LcoyTagsPage-sortOptions">
        {t('categories.tags_sort_by')} {sortLink('count', t('categories.tags_sort_count'))} {sortLink('name', t('categories.tags_sort_name'))}
      </div>
      <hr className="LcoyTagsPage-rule" />
      {sorted.length ? tagsView(sorted, t('categories.tags_all')) : <p className="LcoyTagsPage-empty">{t('categories.tags_none')}</p>}
    </div>
  );
}

function onTagsPage(): boolean {
  return separateTagsPage() && app.current.get('routeName') === 'tags';
}

export default function installCategoriesPage(): void {
  if (!isTagsEnabled()) return;

  const TagsPage = flarum.reg.checkModule('flarum-tags', 'forum/components/TagsPage');

  if (!TagsPage) return;

  // 在分类上方重复的 WelcomeHero 只会把网格向下推；
  // 导航栏中激活的 "分类" 标签已经表明读者所在的位置。
  override(TagsPage.prototype, 'hero', function () {
    return null;
  });

  extend(TagsPage.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    const tagsPage = onTagsPage();

    // Discourse 的标签页没有导航栏。
    if (!tagsPage) items.add('lcoyNav', <ListNavigation />, 200);

    if (this.loading) {
      // 取代加载动画，使用分类的方框（或表格）并带上
      // 真实元素的类名：它们会出现在骨架屏所在的位置。
      if (!tagsPage) {
        items.remove('loading');
        items.add('lcoyCategories', layout() === 'list' ? listSkeleton() : boxesSkeleton(), 100);
      }

      return;
    }

    const tags: LcoyTag[] = this.tags || [];
    const categories = sortTags(tags.filter((tag) => tag.position() !== null && !tag.isChild()));
    const labels = tags.filter((tag) => tag.position() === null).sort((a, b) => b.discussionCount() - a.discussionCount());

    items.remove('tagTiles');
    items.remove('cloud');

    if (tagsPage) {
      items.add('lcoyTagsPage', tagsPageView(labels), 100);

      return;
    }

    if (categories.length) {
      items.add('lcoyCategories', layout() === 'list' ? listView(categories) : boxesView(categories), 100);
    }

    if (labels.length) {
      items.add('lcoyTags', tagsView(labels), 10);
    }
  });
}
