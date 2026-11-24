/*
 * Horizon 中分类页的顶部：巨大的名称、描述，以及
 * 以白色卡片展示、带彩色方块符号的子分类。
 */
import Hero, { type IHeroAttrs } from 'flarum/forum/components/Hero';
import Link from 'flarum/common/components/Link';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { categorySymbol, sortTags, tagSymbol, tagUrl, type LcoyTag } from '../utils/tags';

export interface CategoryHeroAttrs extends IHeroAttrs {
  // 用 "model" 而不是 "tag"：`tag` 属性在到达组件的过程中会丢失。
  model: LcoyTag;
}

export default class CategoryHero extends Hero<CategoryHeroAttrs> {
  className(): string {
    return 'LcoyCategoryHero';
  }

  style(): Record<string, string> | undefined {
    const color = this.attrs.model.color();

    return color ? { '--category-color': color } : undefined;
  }

  bodyItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const tag = this.attrs.model;
    const description = tag.description();

    // 在 Flarum 中带图标的标签（二级标签）：图标在名称之前。
    const icon = tag.position() === null ? tagSymbol(tag, 'LcoyCategoryHero-icon') : null;

    items.add(
      'title',
      <h1 className="LcoyCategoryHero-title">
        {icon}
        {tag.name()}
      </h1>,
      100
    );

    if (description) {
      items.add('description', <p className="LcoyCategoryHero-description">{description}</p>, 90);
    }

    const children = forumBool('lcoyCategoryHeroChildren', true) ? this.children() : [];

    if (children.length) {
      items.add(
        'children',
        <ul className="LcoyCategoryHero-children" aria-label={t('hero.subcategories')}>
          {children.map((child) => (
            <li>
              <Link className="LcoySubcategoryCard" href={tagUrl(child)} style={child.color() ? { '--category-color': child.color() } : undefined}>
                <span className="LcoySubcategoryCard-tile">{categorySymbol(child)}</span>
                <span className="LcoySubcategoryCard-name">{child.name()}</span>
              </Link>
            </li>
          ))}
        </ul>,
        80
      );
    }

    return items;
  }

  children(): LcoyTag[] {
    const children = this.attrs.model.children();

    // 子标签在加载标签时通过 `include=children` 到达；在此之前
    // （或对于标签）没有可列出的内容。
    if (!Array.isArray(children)) return [];

    return sortTags(children.filter(Boolean));
  }
}
