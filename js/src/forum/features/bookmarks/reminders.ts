/*
 * 提醒的时间快捷项，类似 Discourse 的 “time shortcuts”。
 *
 * 时间点遵循 Discourse 的规则：傍晚（18 点）用于“今天稍后”，
 * 上午（8 点）用于其余选项，始终使用浏览器时区——服务端接收
 * UTC 时刻，无需知道任何人的时区。
 */
import { formatWith } from '../../utils/dates';

export type ReminderPreset = 'later_today' | 'tomorrow' | 'next_week' | 'next_month' | 'custom' | 'none';

const MORNING_HOUR = 8;
const EVENING_HOUR = 18;

/** 超过该时间后，“今天稍后”将不足一小时：该快捷项不再显示。 */
const LATER_TODAY_CUTOFF_HOUR = 17;

function at(date: Date, hour: number): Date {
  const result = new Date(date.getTime());
  result.setHours(hour, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);

  return result;
}

/** 各快捷项对应的时间；当前不适用时返回 `null`。 */
export function presetDate(preset: ReminderPreset, now = new Date()): Date | null {
  switch (preset) {
    case 'later_today':
      return now.getHours() < LATER_TODAY_CUTOFF_HOUR ? at(now, EVENING_HOUR) : null;
    case 'tomorrow':
      return at(addDays(now, 1), MORNING_HOUR);
    case 'next_week': {
      // 下一个周一（从不指今天）：即 Discourse 的“一周之始”。
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;

      return at(addDays(now, daysUntilMonday), MORNING_HOUR);
    }
    case 'next_month':
      return at(new Date(now.getFullYear(), now.getMonth() + 1, 1), MORNING_HOUR);
    default:
      return null;
  }
}

/** 当前可用的快捷项，按 Discourse 的顺序排列。 */
export function availablePresets(now = new Date()): ReminderPreset[] {
  const presets: ReminderPreset[] = ['later_today', 'tomorrow', 'next_week', 'next_month'];

  return presets.filter((preset) => presetDate(preset, now) !== null);
}

/** “周六, 08:00”——显示在每个快捷项名称旁。 */
export function presetHint(date: Date, now = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) return formatWith(date, { hour: '2-digit', minute: '2-digit' });

  const withinWeek = date.getTime() - now.getTime() < 6 * 24 * 60 * 60 * 1000;

  return formatWith(
    date,
    withinWeek ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  );
}

/** 提醒的完整日期：“10月18日 星期六, 08:00”。 */
export function reminderLabel(date: Date): string {
  return formatWith(date, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** 本地时区的 `YYYY-MM-DD` 与 `HH:MM`，供 `date` 和 `time` 字段使用。 */
export function toLocalInputs(date: Date): { date: string; time: string } {
  const pad = (value: number) => String(value).padStart(2, '0');

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** 反向转换：自定义时间字段转为一个时刻（不完整时返回 `null`）。 */
export function fromLocalInputs(dateValue: string, timeValue: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!dateMatch) return null;

  const [hours, minutes] = /^(\d{2}):(\d{2})/.test(timeValue) ? timeValue.split(':').map(Number) : [MORNING_HOUR, 0];
  const result = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes, 0, 0);

  return Number.isNaN(result.getTime()) ? null : result;
}
