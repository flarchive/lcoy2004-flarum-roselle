/*
 * fof/polls 按照 Discourse 投票的方式呈现：右栏中较大的投票计数
 * （"0 / 票"），始终可见，扩展的说明文字在其下方。
 * 网格本身（选项 | 信息 / 按钮）由 CSS 负责。
 */
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { thirdParty } from './settings';

export default function installPolls(): void {
  extend('ext:fof/polls/forum/components/Poll/AbstractPoll', 'infoItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.polls()) return;

    const poll = this.attrs.poll;
    const count = Number(poll?.voteCount?.());

    // 没有查看计数的权限时，扩展不会发送该数字。
    if (!Number.isFinite(count) || this.state?.canSeeVoteCount === false) return;

    // 扩展的 "共 N 票" 句子变成较大的数字。
    items.remove('total-vote-count');

    items.add(
      'lcoyVotes',
      <span className="LcoyPollCount">
        <span className="LcoyPollCount-number">{count}</span>
        <span className="LcoyPollCount-label">{t('thirdparty.polls.votes', { count })}</span>
      </span>,
      1000
    );
  });

  // 与 Discourse 相同，百分比（以及 CSS 中依赖它的进度条）只在
  // 投票后或投票结束时出现：在此之前，选项只有
  // 选择用的圆圈。
  extend('ext:fof/polls/forum/components/Poll/PollOption', 'textItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.polls()) return;

    const state = this.attrs.state;

    if (!state?.hasVoted?.() && !state?.poll?.hasEnded?.()) items.remove('percent');
  });
}
