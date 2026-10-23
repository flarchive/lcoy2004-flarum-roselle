/*
 * forumaker/profile-cover 取代主题内置的封面。
 *
 * 扩展启用（且管理员开关打开）时，仍由主题负责绘制：
 * 个人资料的横幅、用户名片的背景以及核心的弹出卡片都从这里
 * 读取封面，这里返回扩展的 `cover`（个人资料）和
 * `cover_thumbnail`（名片），并带上在编辑器中选定的
 * 垂直位置。扩展绘制在 .UserCard 上的背景会在
 * less/forum/thirdparty/ProfileCover.less 中被中和。
 *
 * 编辑由扩展完成：CoverEditorModal，通过它已放在
 * 个人资料 "…" 菜单中的 "封面" 项以及下方 设置 →
 * 个人资料 中的字段打开，取代主题的图片字段。内置图片仍保留在
 * 数据库中，只是不再显示。
 *
 * 主题不保存任何资料数据：简介、所在地和网站来自 fof/user-bio 和
 * fof/socialprofile；这里只读取并定位第三方封面。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import FieldSet from 'flarum/common/components/FieldSet';
import UserCard from 'flarum/forum/components/UserCard';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { extModule, thirdParty } from './settings';

const EDITOR = 'forum/components/CoverEditorModal';

function str(user: User, attribute: string): string | null {
  const value = user.attribute<unknown>(attribute);

  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function safeImageUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** 个人资料的宽幅封面：来自 forumaker/profile-cover（`cover`）。 */
export function userCoverUrl(user: User): string | null {
  return safeImageUrl(str(user, 'cover'));
}

/**
 * 名片背景：同一封面，使用其缩略图（`cover_thumbnail`，
 * 只有在那里启用了缩略图时才存在）。
 */
export function userCardBackgroundUrl(user: User): string | null {
  return safeImageUrl(str(user, 'cover_thumbnail') || str(user, 'cover'));
}

/**
 * 用户在 forumaker 编辑器中选择的垂直位置（0 到 100%），
 * 没有封面时为 null。
 */
export function userCoverPosition(user: User): number | null {
  if (!str(user, 'cover')) return null;

  const value = Number(user.attribute<unknown>('cover_position') ?? 50);

  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
}

/**
 * 图片 CSS 变量的值：`url("…")`。API 会拒绝 URL 中的引号、
 * 括号和空格，但这里的转义并不依赖于此。
 */
export function cssImage(url: string): string {
  return `url("${url.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char))}")`;
}

/**
 * 图片的 CSS 变量，用于个人资料或名片的元素
 * `style`。`--lcoy-cover` 是个人资料 hero 已读取的封面
 * 上层；`--lcoy-user-cover` 和 `--lcoy-user-card-bg` 留给
 * 只想使用其中某一个的地方。
 */
export function profileImageStyle(user: User): Record<string, string> {
  const style: Record<string, string> = {};
  const cover = userCoverUrl(user);
  const card = userCardBackgroundUrl(user);

  if (cover) {
    style['--lcoy-cover'] = cssImage(cover);
    style['--lcoy-user-cover'] = cssImage(cover);
  }

  if (card) style['--lcoy-user-card-bg'] = cssImage(card);

  // forumaker 的位置对封面和名片都有效（缩略图是
  // 缩小后的同一张图片）。没有它时，LESS 规则回退到 `center`。
  const position = userCoverPosition(user);
  if (position !== null && (cover || card)) style['--lcoy-cover-position'] = `center ${position}%`;

  return style;
}

/** 谁可以更换该用户的封面，依据扩展的权限。 */
export function canEditForumakerCover(user: User): boolean {
  return !!user.attribute<boolean>('canSetProfileCover');
}

/** 扩展的编辑器（上传、定位、移除）。来自注册表，绝不通过 import。 */
export function openForumakerCoverEditor(user: User): void {
  const Modal = extModule('forumaker-profile-cover', EDITOR);

  if (Modal) app.modal.show(Modal, { user });
}

export interface ForumakerCoverFieldAttrs extends ComponentAttrs {
  user: User;
}

/**
 * 设置页中的 "个人资料封面" 字段（配合 forumaker）：按所选位置
 * 显示预览，以及打开其编辑器的按钮。每次绘制时从 store 读取
 * 用户，因此预览会跟随弹窗保存的内容。
 */
export class ForumakerCoverField extends Component<ForumakerCoverFieldAttrs> {
  view() {
    const user = this.attrs.user;
    const preview = userCardBackgroundUrl(user);
    const position = userCoverPosition(user);

    return (
      <div className="Form-group LcoyProfileImage LcoyProfileImage--cover LcoyForumakerCover">
        <label>{t('profile.settings.cover_label')}</label>

        <div
          className={`LcoyProfileImage-preview${preview ? ' has-image' : ''}`}
          style={preview ? { backgroundImage: cssImage(preview), backgroundPosition: `center ${position ?? 50}%` } : undefined}
          aria-hidden="true"
        >
          {!preview && <span className="LcoyProfileImage-empty">{t('profile.settings.no_image')}</span>}
        </div>

        {canEditForumakerCover(user) && (
          <div className="LcoyProfileImage-controls">
            <Button className="Button" icon="fas fa-image" onclick={() => openForumakerCoverEditor(user)}>
              {t('profile.settings.cover_edit')}
            </Button>
          </div>
        )}

        <p className="helpText">{t('profile.settings.cover_forumaker_help')}</p>
      </div>
    );
  }
}

/**
 * 核心 UserCard 中的 forumaker 封面，以及设置页中的对应字段。
 * 仅在扩展启用且管理员开关打开时生效；绝不导入它的
 * 模块，一切通过 Flarum 注册表完成。
 */
export default function installProfileCover(): void {
  // 图片作为 CSS 变量放在 .UserCard 本身上：hero 的封面
  // （.LcoyUserHero-cover）继承 `--lcoy-cover`，弹出名片使用
  // `--lcoy-user-card-bg` 作为背景。
  extend(UserCard.prototype, 'view', function (this: any, vnode: Mithril.Vnode<any, any>) {
    if (!vnode?.attrs || !thirdParty.profileCover()) return;

    const user: User = this.attrs.user;
    const images = profileImageStyle(user);

    if (!Object.keys(images).length) return;

    // 用户没有颜色时，核心会把 `false` 作为 style 传入。
    const style = vnode.attrs.style && typeof vnode.attrs.style === 'object' ? vnode.attrs.style : {};
    vnode.attrs.style = { ...style, ...images };
    vnode.attrs.className = classList(vnode.attrs.className, {
      'LcoyProfile--hasCardBg': !!userCardBackgroundUrl(user),
    });
  });

  extend('flarum/forum/components/SettingsPage' as any, 'settingsItems', function (this: any, items: ItemList<Mithril.Children>) {
    const user: User | undefined = this.user;

    if (!user || user !== app.session.user || !thirdParty.profileCover()) return;

    items.add(
      'lcoyProfile',
      <FieldSet className="Settings-lcoyProfile FieldSet--col" label={t('profile.settings.heading')}>
        <ForumakerCoverField user={user} />
      </FieldSet>,
      95
    );
  });
}
