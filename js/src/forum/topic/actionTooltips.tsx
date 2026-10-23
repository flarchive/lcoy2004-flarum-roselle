/*
 * 帖子操作栏中只显示图标的按钮（书签、解决方案、点赞、链接、“…”以及其他扩展的按钮）上的
 * 提示（核心的 Tooltip）。原生的 `title` 出现得慢，而且不跟随主题的视觉。
 *
 * 最后运行（beforeMount 注册在主题 initializer 的末尾），以便能看到各功能与扩展
 * 已经放进操作栏的按钮。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import CommentPost from 'flarum/forum/components/CommentPost';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

/** 一个只有图标的按钮，附带提示将要显示的描述。 */
function iconOnlyLabel(vnode: any): string | null {
  if (!vnode || typeof vnode !== 'object' || vnode.tag !== Button || !vnode.attrs) return null;

  const className = String(vnode.attrs.className || '');

  if (!/\bButton--icon\b/.test(className)) return null;

  const label = vnode.attrs.title || vnode.attrs['aria-label'];

  return typeof label === 'string' && label ? label : null;
}

export default function installActionTooltips(): void {
  app.beforeMount(() => {
    extend(CommentPost.prototype, 'actionItems', function (items: ItemList<Mithril.Children>) {
      Object.keys(items.toObject()).forEach((key) => {
        const vnode: any = items.get(key);
        const label = iconOnlyLabel(vnode);

        if (!label) return;

        const className = String(vnode.attrs.className || '');

        // 提示取代原生 `title`（否则两者会同时出现）。
        vnode.attrs = { ...vnode.attrs, title: undefined, 'aria-label': label };

        items.setContent(
          key,
          // 刚复制完链接时，“链接已复制！”的反馈会占据按钮上方提示的位置。
          <Tooltip text={label} tooltipVisible={/\bLcoyPostAction--copied\b/.test(className) ? false : undefined}>
            {vnode}
          </Tooltip>
        );
      });
    });
  });
}
