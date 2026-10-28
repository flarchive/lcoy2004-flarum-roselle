/*
 * 打开的菜单（标签页和面板）以及 /notifications 页面的通知列表：
 * 一个 chunk，在指针或焦点到达头像时请求（点击时通常已经准备好），
 * 或在核心通知页面即将加载时请求。
 */
import { once } from '../utils/chunkGate';

export const loadMenu = once(() => import('./menuChunk').then((mod) => mod.default));
