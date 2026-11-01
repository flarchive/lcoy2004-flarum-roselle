/*
 * 主题列表加载时闪烁的占位行（切换
 * 分类、过滤器或排序时），取代核心的加载动画。
 *
 * 每一行使用真实行的相同类名（listItem.tsx）：标题、
 * 徽章、发帖人、回复、浏览量以及活动，桌面端按列显示，
 * 移动端显示 48px 头像且数字位于角落。占位条
 * 位于这些元素内部（使用它们的字体和行高），
 * 落在文字将要出现的位置：列表加载完成时不会跳动。
 */
import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';

const ROWS = 8;

/** 逐行变化的宽度，以免看起来像网格。 */
const TITLES = [62, 44, 71, 38, 55, 66, 48, 59];
const BADGES = ['5em', '7em', '4.5em', '6em'];

function row(index: number, showViews: boolean): Mithril.Children {
  return (
    <li key={`lcoy-skeleton-${index}`} className="LcoyListSkeleton-item" aria-hidden="true">
      <div className="DiscussionListItem LcoyListSkeleton">
        <div className="DiscussionListItem-content">
          <div className="LcoyListItem-avatar">
            <span className="Avatar LcoySkeleton" />
          </div>
          <div className="DiscussionListItem-main LcoyTopic">
            <h2 className="DiscussionListItem-title LcoyTopic-titleLine">
              <span className="LcoySkeleton LcoySkeleton--line" style={{ width: `${TITLES[index % TITLES.length]}%` }} />
            </h2>
            <div className="LcoyTopic-meta">
              <span className="LcoySkeleton LcoySkeleton--line" style={{ width: BADGES[index % BADGES.length] }} />
            </div>
          </div>
          {forumBool('lcoyListPosters', true) && (
            <div className="LcoyCell LcoyCell--posters LcoyPosters">
              {index % 3 ? (
                <span className="LcoyPosters-avatar">
                  <span className="Avatar LcoySkeleton" />
                </span>
              ) : null}
              <span className="LcoyPosters-avatar LcoyPosters-avatar--latest">
                <span className="Avatar LcoySkeleton" />
              </span>
            </div>
          )}
          <div className="LcoyCell LcoyCell--replies">
            <span className="LcoySkeleton LcoySkeleton--word LcoyListSkeleton-number" />
          </div>
          {showViews && (
            <div className="LcoyCell LcoyCell--views">
              <span className="LcoySkeleton LcoySkeleton--word LcoyListSkeleton-number" />
            </div>
          )}
          <div className="LcoyCell LcoyCell--activity">
            <span className="LcoyActivity">
              <span className="LcoySkeleton LcoySkeleton--word LcoyListSkeleton-age" />
            </span>
          </div>
        </div>
        {/* 真实行中 ⋮ 的列（仅对有控制权的人）：页眉
            和各行在加载前后预留相同的宽度。 */}
        {app.session.user ? <div className="DiscussionListItem-controls" /> : null}
      </div>
    </li>
  );
}

export default function listSkeleton(showViews: boolean): Mithril.Children[] {
  return Array.from({ length: ROWS }, (_, index) => row(index, showViews));
}
