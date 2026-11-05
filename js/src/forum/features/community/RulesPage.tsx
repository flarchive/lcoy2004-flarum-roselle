import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import AboutNav from './AboutNav';
import CommunityPage from './CommunityPage';
import { t } from '../../utils/settings';

type RulesSection = { id: string; title: string; html: string };

export interface RulesPayload {
  html: string | null;
  title?: string;
}

/**
 * 按 `h2` 标题切分 HTML：之前的内容为引言（放在顶部），每个标题
 * 成为一个带锚点的章节。列表项各自变成一条带编号的“规则”。
 * HTML 来自服务端（fof/pages 页面或管理员文本），已在服务端
 * 净化。
 */
function structure(html: string): { intro: string; sections: RulesSection[] } {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild as HTMLElement;
  const sections: RulesSection[] = [];
  const intro: string[] = [];
  let current: { title: string; nodes: string[] } | null = null;
  const used = new Set<string>();

  const flush = () => {
    if (!current) return;

    let id =
      'regra-' +
      (current.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || sections.length + 1);
    while (used.has(id)) id += '-';
    used.add(id);
    sections.push({ id, title: current.title, html: current.nodes.join('') });
  };

  Array.from(root?.childNodes || []).forEach((node) => {
    if (node instanceof HTMLElement && node.tagName === 'H2') {
      flush();
      current = { title: node.textContent?.trim() || '', nodes: [] };
      return;
    }

    if (node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')) {
      node.classList.add('LcoyRules-list');
      Array.from(node.children).forEach((li, index) => {
        li.classList.add('LcoyRules-rule');
        li.setAttribute('data-n', String(index + 1));
      });
    }

    const out = node instanceof HTMLElement ? node.outerHTML : node.textContent?.trim() ? `<p>${node.textContent}</p>` : '';
    (current ? current.nodes : intro).push(out);
  });

  flush();

  return { intro: intro.join(''), sections };
}

/**
 * “关于”区域中规则页面的基类（“准则”以及 fof/pages 的额外页面）：
 * 标题、以胶囊按钮呈现的章节索引，以及每节一张卡片。
 * 每个页面只需说明 HTML 的来源和哪个标签处于激活状态。
 */
export default abstract class RulesPage extends CommunityPage {
  html: string | null = null;
  pageTitle: string | null = null;
  failed = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (this.enabled()) this.load();
  }

  /** API 地址，相对路径（`/lcoy-guidelines`）。 */
  abstract endpoint(): string;

  /** AboutNav 中高亮显示的标签。 */
  abstract activeTab(): string;

  load(): void {
    app
      .request<RulesPayload>({
        method: 'GET',
        url: `${(app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '')}${this.endpoint()}`,
      })
      .then((data) => {
        this.html = data?.html || '';
        this.pageTitle = data?.title || null;
        this.loaded(data);
      })
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());
  }

  /** 加载完成后执行（额外页面会更新浏览器标签页标题）。 */
  loaded(_data: RulesPayload): void {}

  content(): Mithril.Children {
    let body: Mithril.Children;

    if (this.failed) body = <p className="LcoyCommunity-empty">{t('community.load_error')}</p>;
    else if (this.html === null) body = this.skeleton();
    else body = this.rules(this.html);

    return (
      <div className="LcoyAbout LcoyGuidelines">
        <header className="LcoyAbout-header">{AboutNav(this.activeTab())}</header>
        {body}
      </div>
    );
  }

  /**
   * 文本尚未到达：标题（已确定）和两张沿用真实类名的规则卡片，
   * 用骨架条代替文字行，使内容到达时正落在骨架所在的位置。
   */
  skeleton(): Mithril.Children {
    const line = (width: string) => <span className="LcoySkeleton LcoySkeleton--line" style={{ width }} />;

    return (
      <div className="LcoyRules LcoyRules--loading" aria-busy="true">
        <h1 className="LcoyRules-title">{this.title()}</h1>
        <nav className="LcoyRules-toc" aria-hidden="true">
          {['9em', '12em', '8em', '11em', '10em', '7em'].map((width) => (
            <a>
              <span className="LcoySkeleton LcoySkeleton--word" style={{ width }} />
            </a>
          ))}
        </nav>
        {[
          ['30%', ['100%', '94%', '72%']],
          ['24%', ['96%', '100%', '58%']],
        ].map(([title, lines]) => (
          <section className="LcoyRules-card">
            <h2 className="LcoyRules-sectionTitle">{line(title as string)}</h2>
            <div className="LcoyRules-body Post-body">
              <p>{(lines as string[]).map(line)}</p>
            </div>
          </section>
        ))}
      </div>
    );
  }

  rules(html: string): Mithril.Children {
    const { intro, sections } = structure(html);
    const title = this.pageTitle || this.title();

    return (
      <div className="LcoyRules">
        <h1 className="LcoyRules-title">{title}</h1>

        {/* 没有任何 h2 时，整段文本就是内容：放在一张卡片中，并带编号规则。 */}
        {intro &&
          (sections.length ? (
            <div className="LcoyRules-intro Post-body">{m.trust(intro)}</div>
          ) : (
            <section className="LcoyRules-card">
              <div className="LcoyRules-body Post-body">{m.trust(intro)}</div>
            </section>
          ))}

        {sections.length > 1 && (
          <nav className="LcoyRules-toc" aria-label={title}>
            {sections.map((section) => (
              <a
                href={`#${section.id}`}
                onclick={(e: MouseEvent) => {
                  e.preventDefault();
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {section.title}
              </a>
            ))}
          </nav>
        )}

        {sections.map((section) => (
          <section className="LcoyRules-card" id={section.id}>
            <h2 className="LcoyRules-sectionTitle">{section.title}</h2>
            <div className="LcoyRules-body Post-body">{m.trust(section.html)}</div>
          </section>
        ))}
      </div>
    );
  }
}
