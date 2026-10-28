/*
 * 在 Windows 上，核心用系统分隔符写入 chunk 的修订号
 * （`js\lcoy-roselle\forum\features/messages/ui.js`），而加载器查找的是
 * `js/lcoy-roselle/forum/features/messages/ui.js`。找不到修订号时，chunk 会
 * 缺少 `?v=`，构建后浏览器可能继续使用旧缓存——链接就“点不到任何地方”。
 *
 * 在模块求值时运行，早于任何 chunk 请求：核心的注册表只在第一次按需加载时
 * 读取（并保存）清单。Linux 服务器上的键本来就带 “/”，不做任何改动。
 */
export default function normalizeRevManifest(): void {
  const node = typeof document !== 'undefined' ? document.getElementById('flarum-rev-manifest') : null;

  if (!node?.textContent || node.textContent.indexOf('\\\\') === -1) return;

  try {
    const revisions = JSON.parse(node.textContent) as Record<string, string>;
    const normalized: Record<string, string> = {};

    for (const key of Object.keys(revisions)) {
      normalized[key] = revisions[key];
      normalized[key.replace(/\\/g, '/')] = revisions[key];
    }

    node.textContent = JSON.stringify(normalized);

    // 注册表可能已经读过清单（启动时的核心 chunk）：把它保存的映射补齐。
    const reg = (window as any).flarum?.reg;

    if (reg && reg._revisions) Object.assign(reg._revisions, normalized);
  } catch {
    // 清单无法解析：核心保持原状。
  }
}
