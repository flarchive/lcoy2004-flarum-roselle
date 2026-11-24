/*
 * 读取 extend.php 在论坛中序列化的主题配置
 * （`lcoy*`）。PHP 已经转换了布尔值和整数，但属性在启用扩展后
 * 的一瞬间可能缺失——因此需要默认值。
 */
import app from 'flarum/forum/app';

export function forumBool(attributeName: string, fallback = false): boolean {
  // 在 initializer 中 `app.forum` 还不存在：使用默认值。
  if (!app.forum) return fallback;

  const value = app.forum.attribute<unknown>(attributeName);

  return value === undefined || value === null ? fallback : !!value;
}

export function forumInt(attributeName: string, fallback: number): number {
  if (!app.forum) return fallback;

  const value = Number(app.forum.attribute<unknown>(attributeName));

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** 将主题翻译直接作为字符串获取的快捷方式（标题、aria-label……）。 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`lcoy-roselle.forum.${key}`, params, true) as string;
}

export function isExtensionEnabled(id: string): boolean {
  return id in flarum.extensions;
}
