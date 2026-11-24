/*
 * 个人资料页的“草稿”标签（`/u/:username/drafts`），与 Discourse 一致，
 * 使用 fof/drafts 的草稿：仅本人可见。每条草稿显示类型（新主题、
 * 回复、私信）、标题、文本开头以及最后修改距今的时间，并提供
 * “继续”和“删除”。
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Placeholder from 'flarum/common/components/Placeholder';
import { truncate } from 'flarum/common/utils/string';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import {
  allDrafts,
  deleteDraft,
  draftIcon,
  draftsOn,
  draftTitle,
  ensureDiscussions,
  fofState,
  loadDrafts,
  openDraft,
  type FofDraft,
} from './fofDrafts';
import { fullDate, shortAge } from '../../../utils/dates';
import { t } from '../../../utils/settings';

const TYPE_KEYS = {
  discussion: 'type_new_topic',
  reply: 'type_reply',
  privateDiscussion: 'type_message',
};

export default class DraftsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  private loading = true;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    // 草稿属于撰写者：在他人资料页上该标签不存在，手动输入的
    // URL 会跳转到对方的帖子页。
    if (user !== app.session.user || !draftsOn()) {
      m.route.set(app.route('user.posts', { username: user.slug() }), undefined, { replace: true });
      return;
    }

    super.show(user);

    loadDrafts().then(() => {
      this.loading = false;
      m.redraw();
    });
  }

  content() {
    if (this.loading) return <LoadingIndicator />;

    const drafts = allDrafts();
    const state = fofState();

    if (!drafts.length) return <Placeholder text={t('composer.drafts.empty')} />;

    ensureDiscussions(drafts);

    return (
      <div className="LcoyDrafts">
        <ul className="LcoyDrafts-list">{drafts.map((draft) => this.item(draft))}</ul>
        {state?.hasNextPage && (
          <div className="LcoyDrafts-more">
            <Button className="Button" loading={state.loadingMore} onclick={() => state.loadMore()}>
              {t('composer.drafts.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  private item(draft: FofDraft): Mithril.Children {
    const type = draft.type();
    const updated = draft.updatedAt();
    const text = (draft.content() || '').replace(/\s+/g, ' ').trim();

    return (
      <li key={draft.id()} className={`LcoyDrafts-item LcoyDrafts-item--${type}`}>
        <span className="LcoyDrafts-icon" aria-hidden="true">
          <Icon name={draftIcon(draft)} />
        </span>
        <div className="LcoyDrafts-main">
          <div className="LcoyDrafts-context">
            {t(`composer.drafts.${TYPE_KEYS[type] || 'type_new_topic'}`)}
            {updated && (
              <time className="LcoyDrafts-time" dateTime={updated.toISOString()} title={fullDate(updated)}>
                {' · '}
                {shortAge(updated)}
              </time>
            )}
          </div>
          <h3 className="LcoyDrafts-title">{draftTitle(draft)}</h3>
          {text && <p className="LcoyDrafts-excerpt">{truncate(text, 200)}</p>}
        </div>
        <div className="LcoyDrafts-actions">
          <Button className="Button Button--primary" icon="fas fa-pen" onclick={() => openDraft(draft)}>
            {t('composer.drafts.resume')}
          </Button>
          <Button
            className="Button Button--icon LcoyDrafts-delete"
            icon="far fa-trash-can"
            aria-label={t('composer.drafts.delete')}
            title={t('composer.drafts.delete')}
            onclick={() => deleteDraft(draft)}
          />
        </div>
      </li>
    );
  }
}
