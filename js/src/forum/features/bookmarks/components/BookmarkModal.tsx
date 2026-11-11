/*
 * “编辑书签”，Discourse 的弹窗（bookmark-reminder-modal）：可选的名称、
 * 带时间快捷项的“提醒我”（今天稍后、明天、下周、下个月、自定义或
 * 不提醒），以及页脚中的保存、取消和删除。
 *
 * 同一个弹窗既用于创建（帖子尚未收藏）也用于编辑。在点击保存之前
 * 不会写入任何内容：取消会撤销全部更改，与 Discourse 一致。
 */
import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import Stream from 'flarum/common/utils/Stream';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { bookmarkRecord, createBookmark, deleteBookmark, postBookmark, updateBookmark } from '../actions';
import { availablePresets, fromLocalInputs, presetDate, presetHint, reminderLabel, toLocalInputs, type ReminderPreset } from '../reminders';

export interface BookmarkModalAttrs extends IFormModalAttrs {
  post: Post;
}

const PRESET_ICONS: Record<ReminderPreset, string> = {
  later_today: 'fas fa-moon',
  tomorrow: 'fas fa-sun',
  next_week: 'fas fa-briefcase',
  next_month: 'far fa-calendar-plus',
  custom: 'fas fa-calendar-alt',
  none: 'fas fa-ban',
};

/** 与数据库中 `name` 列相同的长度限制。 */
const NAME_MAX_LENGTH = 100;

export default class BookmarkModal extends FormModal<BookmarkModalAttrs> {
  name!: Stream<string>;
  preset!: ReminderPreset | null;
  customDate!: Stream<string>;
  customTime!: Stream<string>;

  /** 已存在的提醒：若未选择任何快捷项，则保持有效。 */
  existingReminder: Date | null = null;

  oninit(vnode: Mithril.Vnode<BookmarkModalAttrs, this>) {
    super.oninit(vnode);

    const state = postBookmark(this.attrs.post);
    const reminder = state?.reminderAt && state.reminderAt.getTime() > Date.now() ? state.reminderAt : null;
    const custom = toLocalInputs(reminder ?? presetDate('tomorrow')!);

    this.name = Stream(state?.name ?? '');
    this.existingReminder = reminder;
    // 尚未选择：保存时保持当前提醒（或没有提醒）。
    this.preset = null;
    this.customDate = Stream(custom.date);
    this.customTime = Stream(custom.time);
  }

  className() {
    return 'LcoyBookmarkModal Modal--small';
  }

  title() {
    return postBookmark(this.attrs.post) ? t('bookmarks.modal.edit_title') : t('bookmarks.modal.create_title');
  }

  content() {
    const isEditing = !!postBookmark(this.attrs.post);

    return (
      <div className="Modal-body">
        <div className="Form">
          <div className="Form-group">
            <label className="LcoyBookmarkModal-label" for="lcoy-bookmark-name">
              {t('bookmarks.modal.name_label')}
            </label>
            <input
              id="lcoy-bookmark-name"
              className="FormControl"
              name="name"
              type="text"
              maxlength={NAME_MAX_LENGTH}
              placeholder={t('bookmarks.modal.name_placeholder')}
              bidi={this.name}
            />
          </div>

          {this.existingReminder && this.preset === null && (
            <p className="LcoyBookmarkModal-existing">
              <Icon name="far fa-clock" />
              <span>{t('bookmarks.modal.existing_reminder', { date: reminderLabel(this.existingReminder) })}</span>
            </p>
          )}

          <fieldset className="Form-group LcoyBookmarkModal-reminder">
            <legend className="LcoyBookmarkModal-label">{t('bookmarks.modal.reminder_label')}</legend>
            <div className="LcoyBookmarkModal-presets" role="radiogroup">
              {[...availablePresets(), 'custom' as const, 'none' as const].map((preset) => this.presetButton(preset))}
            </div>

            {this.preset === 'custom' && (
              <div className="LcoyBookmarkModal-custom">
                <input className="FormControl" type="date" aria-label={t('bookmarks.modal.custom_date')} bidi={this.customDate} />
                <input className="FormControl" type="time" aria-label={t('bookmarks.modal.custom_time')} bidi={this.customTime} />
              </div>
            )}
          </fieldset>

          <div className="Form-group LcoyBookmarkModal-footer">
            <Button className="Button Button--primary" type="submit" loading={this.loading}>
              {t('bookmarks.modal.save')}
            </Button>
            <Button className="Button Button--flat" onclick={() => this.hide()}>
              {t('bookmarks.modal.cancel')}
            </Button>
            {isEditing && (
              <Button
                className="Button Button--flat LcoyBookmarkModal-delete"
                icon="far fa-trash-alt"
                onclick={() => this.remove()}
                disabled={this.loading}
              >
                {t('bookmarks.modal.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  presetButton(preset: ReminderPreset): Mithril.Children {
    const date = presetDate(preset);
    const selected = this.preset === preset;

    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected ? 'true' : 'false'}
        className={classList('LcoyBookmarkModal-preset', { 'is-selected': selected })}
        onclick={() => (this.preset = selected ? null : preset)}
      >
        <Icon name={PRESET_ICONS[preset]} className="LcoyBookmarkModal-presetIcon" />
        <span className="LcoyBookmarkModal-presetLabel">{t(`bookmarks.presets.${preset}`)}</span>
        {date && <span className="LcoyBookmarkModal-presetHint">{presetHint(date)}</span>}
      </button>
    );
  }

  /**
   * 要写入的提醒：`undefined` 保持现状，`null` 移除，日期则替换。
   * 自定义时间无效时返回 `false`。
   */
  chosenReminder(): Date | null | undefined | false {
    switch (this.preset) {
      case null:
        return undefined;
      case 'none':
        return null;
      case 'custom': {
        const date = fromLocalInputs(this.customDate(), this.customTime());

        return date && date.getTime() > Date.now() ? date : false;
      }
      default:
        return presetDate(this.preset);
    }
  }

  onsubmit(e: SubmitEvent): void {
    e.preventDefault();

    const reminderAt = this.chosenReminder();

    if (reminderAt === false) {
      this.alertAttrs = { type: 'error', content: t('bookmarks.modal.invalid_date') };
      m.redraw();
      return;
    }

    const post = this.attrs.post;
    const bookmark = bookmarkRecord(post);
    const changes = { name: this.name(), reminderAt };

    this.loading = true;
    this.alertAttrs = null;

    (bookmark ? updateBookmark(post, bookmark, changes) : createBookmark(post, changes))
      .then(() => this.hide())
      .catch(() => {
        // API 错误已显示在全局提示中；弹窗保持打开
        // 以便重试。
        this.loading = false;
        m.redraw();
      });
  }

  remove(): void {
    const post = this.attrs.post;

    this.loading = true;

    deleteBookmark(post)
      .then(() => {
        app.alerts.show({ type: 'success' }, t('bookmarks.alerts.removed'));
        this.hide();
      })
      .catch(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
