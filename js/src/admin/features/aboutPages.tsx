/*
 * fof/pages 页面列表，这些页面会成为“关于”区域的额外标签页
 * （设置 `lcoy.about_pages`，JSON `[{id, label, icon}]`，按标签页
 * 顺序）。服务器在保存时会清理 JSON（整数 id，最多 20 个），
 * 并且只在论坛中显示每个人有权查看的页面。
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { AdminComponent, trans, getStr, saveSetting } from '../util';

const KEY = 'lcoy-roselle.admin.settings.community';
const SETTING = 'lcoy.about_pages';
const MAX = 20;
const SAVE_DELAY_MS = 600;

interface Entry {
  id: number;
  label: string;
  icon: string;
}

interface FofPage {
  id: number;
  title: string;
  slug: string;
}

function readEntries(): Entry[] {
  try {
    const parsed = JSON.parse(getStr(SETTING, '[]'));

    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item && Number(item.id) > 0)
          .map((item) => ({ id: Number(item.id), label: String(item.label || ''), icon: String(item.icon || '') }))
      : [];
  } catch {
    return [];
  }
}

export default class AboutPagesEditor extends AdminComponent {
  pages: FofPage[] | null = null;
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  oninit(vnode: any) {
    super.oninit(vnode);

    app
      .request<any>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/pages`, params: { 'page[limit]': 50 } })
      .then((res) => {
        this.pages = (res?.data || []).map((p: any) => ({
          id: Number(p.id),
          title: String(p.attributes?.title || p.id),
          slug: String(p.attributes?.slug || ''),
        }));
      })
      .catch(() => (this.pages = []))
      .finally(() => m.redraw());
  }

  onremove(vnode: any) {
    super.onremove(vnode);

    // 在输入暂停期间离开不能丢失标签。
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flush();
    }
  }

  /** 立即存入 `app.data`（重绘时字段不会“回滚”），然后立即保存或在暂停后保存。 */
  write(entries: Entry[], debounce = false): void {
    app.data.settings[SETTING] = JSON.stringify(entries);
    clearTimeout(this.saveTimer);

    if (debounce) this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    else this.flush();
  }

  flush(): void {
    this.saveTimer = undefined;
    saveSetting({ [SETTING]: getStr(SETTING, '[]') });
  }

  view() {
    const entries = readEntries();
    const byId = new Map((this.pages || []).map((page) => [page.id, page]));
    const used = new Set(entries.map((entry) => entry.id));
    const available = (this.pages || []).filter((page) => !used.has(page.id));
    const baseUrl = app.forum.attribute<string>('baseUrl');

    const update = (index: number, patch: Partial<Entry>, debounce = false) =>
      this.write(
        entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
        debounce
      );

    const move = (index: number, delta: number) => {
      const next = entries.slice();
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      this.write(next);
    };

    return (
      <div className="Form-group LcoyAdmin-aboutPages">
        {entries.length > 0 && (
          <ol className="LcoyAdmin-aboutPagesList">
            {entries.map((entry, index) => {
              const page = byId.get(entry.id);
              const title = page?.title || trans(`${KEY}.about_pages_missing`, '页面 #{id}（未找到）', { id: entry.id });

              return (
                <li key={entry.id} className="LcoyAdmin-aboutPage">
                  <div className="LcoyAdmin-aboutPageHead">
                    <span className="LcoyAdmin-aboutPageIcon" aria-hidden="true">
                      <i className={entry.icon || 'far fa-file-lines'} />
                    </span>
                    <strong className="LcoyAdmin-aboutPageTitle">{title}</strong>
                    {page && (
                      <a
                        className="LcoyAdmin-aboutPageView"
                        href={`${baseUrl}/about/${page.slug ? `${page.id}-${page.slug}` : page.id}`}
                        target="_blank"
                        rel="noopener"
                        title={trans(`${KEY}.view_page`, '在论坛中查看该页面')}
                      >
                        <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
                      </a>
                    )}
                    <span className="LcoyAdmin-aboutPageActions">
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-arrow-up"
                        disabled={index === 0}
                        aria-label={trans(`${KEY}.about_pages_up`, '上移')}
                        onclick={() => move(index, -1)}
                      />
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-arrow-down"
                        disabled={index === entries.length - 1}
                        aria-label={trans(`${KEY}.about_pages_down`, '下移')}
                        onclick={() => move(index, 1)}
                      />
                      <Button
                        className="Button Button--icon Button--link LcoyAdmin-aboutPageRemove"
                        icon="fas fa-xmark"
                        aria-label={trans(`${KEY}.about_pages_remove`, '从关于区域中移除')}
                        onclick={() => this.write(entries.filter((_, i) => i !== index))}
                      />
                    </span>
                  </div>
                  <div className="LcoyAdmin-aboutPageFields">
                    <label>
                      <span>{trans(`${KEY}.about_pages_label`, '标签文本')}</span>
                      <input
                        className="FormControl"
                        type="text"
                        maxlength={60}
                        value={entry.label}
                        placeholder={page?.title || ''}
                        oninput={(e: InputEvent) => update(index, { label: (e.target as HTMLInputElement).value }, true)}
                      />
                    </label>
                    <label>
                      <span>{trans(`${KEY}.about_pages_icon`, '图标（可选）')}</span>
                      <input
                        className="FormControl"
                        type="text"
                        maxlength={60}
                        value={entry.icon}
                        placeholder="fas fa-book"
                        oninput={(e: InputEvent) => update(index, { icon: (e.target as HTMLInputElement).value }, true)}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {entries.length < MAX && (
          <select
            className="FormControl LcoyAdmin-aboutPagesAdd"
            value=""
            disabled={this.pages === null || available.length === 0}
            onchange={(e: Event) => {
              const id = Number((e.target as HTMLSelectElement).value);
              if (id > 0) this.write([...entries, { id, label: '', icon: '' }]);
            }}
          >
            <option value="">
              {this.pages !== null && available.length === 0
                ? trans(`${KEY}.about_pages_none_left`, '所有 fof/pages 页面都已在此列表中')
                : trans(`${KEY}.about_pages_add`, '添加页面…')}
            </option>
            {available.map((page) => (
              <option value={String(page.id)}>{page.title}</option>
            ))}
          </select>
        )}

        <p className="helpText">
          {trans(
            `${KEY}.about_pages_list_help`,
            '每个页面会按列表顺序成为「关于」和「社区守则」之后的标签页，地址为 /about/id-slug，布局与社区守则一致。标签留空则使用页面标题；图标为 Font Awesome 类名。fof/pages 中隐藏或受限的页面只对能看到它们的人显示。'
          )}
        </p>
      </div>
    );
  }
}
