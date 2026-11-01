/*
 * 谁点了赞 / 谁做出了反应：discourse-reactions 的 popover，点击帖子操作栏的
 * 计数时打开——带阴影的白色卡片、指向计数的箭头，以及列表（32px 头像、
 * 名字，右侧是各自的爱心或反应 emoji）。约 8 人之后滚动。
 *
 * 同时服务于点赞（flarum/likes）和反应（fof/reactions）：打开者传入列表
 * 加载器。每页只有一个 popover，挂载在 body 的一个 <div> 上——放在帖子内部
 * 会被裁剪，并被 SubtreeRetainer 困住。
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

export interface ReactorEntry {
  user: User;
  /** 右侧的图标：红色爱心或反应 emoji。 */
  icon: Mithril.Children;
}

interface State {
  anchor: HTMLElement;
  entries: ReactorEntry[] | null;
}

let state: State | null = null;
let root: HTMLElement | null = null;

/** 箭头到计数的距离，以及到窗口边缘的距离。 */
const GAP = 10;
const EDGE = 8;

function onDocumentEvent(event: Event) {
  if (!state) return;

  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') closeWhoReacted();
    return;
  }

  const target = event.target as Node;

  if (root?.contains(target) || state.anchor.contains(target)) return;

  closeWhoReacted();
}

function ensureRoot() {
  if (root) return;

  root = document.createElement('div');
  root.className = 'LcoyReactorsRoot';
  document.body.appendChild(root);

  m.mount(root, { view: () => (state ? <ReactorsPopover anchor={state.anchor} entries={state.entries} /> : null) });

  document.addEventListener('mousedown', onDocumentEvent, true);
  document.addEventListener('keydown', onDocumentEvent, true);
  window.addEventListener('popstate', () => closeWhoReacted());
}

export function closeWhoReacted(): void {
  if (!state) return;

  state = null;
  m.redraw();
}

/** 打开（或在同一计数上再次点击时关闭）做出反应的列表。 */
export function openWhoReacted(anchor: HTMLElement, load: () => Promise<ReactorEntry[]>): void {
  ensureRoot();

  if (state && state.anchor === anchor) {
    closeWhoReacted();
    return;
  }

  const current: State = { anchor, entries: null };
  state = current;
  m.redraw();

  load()
    .catch(() => [] as ReactorEntry[])
    .then((entries) => {
      if (state !== current) return;

      // 没有可见项（无权限，或列表请求失败）：空卡片说明不了什么
      // ——popover 直接关闭。
      if (!entries.length) {
        closeWhoReacted();
        return;
      }

      current.entries = entries;
      m.redraw();
    });
}

/** 点赞的红色爱心（Discourse 的 ❤️ emoji）。 */
export function heartIcon(): Mithril.Children {
  return <i aria-hidden="true" className="icon fas fa-heart LcoyReactors-heart" />;
}

interface PopoverAttrs {
  anchor: HTMLElement;
  entries: ReactorEntry[] | null;
}

class ReactorsPopover {
  view(vnode: Mithril.Vnode<PopoverAttrs, this>) {
    const { entries } = vnode.attrs;

    return (
      <div className="LcoyReactors" role="dialog" aria-label={app.translator.trans('lcoy-roselle.forum.topic.post.who_liked', {}, true) as string}>
        <span className="LcoyReactors-arrow" />
        {entries === null ? (
          <LoadingIndicator size="small" display="block" />
        ) : (
          <ul className="LcoyReactors-list">
            {entries.map((entry) => (
              <li>
                <Link className="LcoyReactors-user" href={app.route.user(entry.user)} onclick={() => closeWhoReacted()}>
                  <Avatar user={entry.user} />
                  <span className="LcoyReactors-name">{username(entry.user)}</span>
                  <span className="LcoyReactors-icon">{entry.icon}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<PopoverAttrs, this>) {
    this.place(vnode);
  }

  onupdate(vnode: Mithril.VnodeDOM<PopoverAttrs, this>) {
    this.place(vnode);
  }

  /** 紧贴计数下方、以其居中，且不超出窗口。 */
  place(vnode: Mithril.VnodeDOM<PopoverAttrs, this>) {
    const el = vnode.dom as HTMLElement;
    const rect = vnode.attrs.anchor.getBoundingClientRect();
    const width = el.offsetWidth;
    const center = rect.left + rect.width / 2;
    const left = Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, center - width / 2));

    el.style.top = `${rect.bottom + window.scrollY + GAP}px`;
    el.style.left = `${left + window.scrollX}px`;
    el.style.setProperty('--lcoy-arrow-left', `${center - left}px`);
  }
}
