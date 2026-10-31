/*
 * “在这个 chunk 之前，先加载我们的”：当 Flarum 的注册表要下载
 * 另一个包（核心、flarum/messages……）的 chunk 时，主题中扩展它的
 * chunk 会先下载。这样主题的扩展会进入
 * `flarum.reg.onLoad` 的队列（或者主题绘制的组件已经准备好），
 * 当那边的模块到达时，不会出现没有主题的绘制。
 */
type Gate = { matches: (namespace: string, url: string) => boolean; load: () => Promise<unknown> };

const gates: Gate[] = [];
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;

  const reg: any = flarum.reg;
  const original = reg.loadChunk;

  // 核心的签名：(original, url, done, key, chunkId, namespace)。
  reg.loadChunk = function (this: unknown, ...args: any[]) {
    const url = String(args[1] ?? '');
    const namespace = String(args[5] ?? '');
    const pending = gates.filter((gate) => gate.matches(namespace, url)).map((gate) => gate.load().catch(() => {}));

    if (!pending.length) return original.apply(this, args);

    return Promise.all(pending).then(() => original.apply(this, args));
  };
}

/** 每次加载只执行一次：promise 会被缓存（失败时重新创建）。 */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;

  return () => {
    promise ||= load().catch((error) => {
      promise = null;
      throw error;
    });

    return promise;
  };
}

export function beforeChunk(matches: Gate['matches'], load: () => Promise<unknown>): void {
  install();
  gates.push({ matches, load });
}
