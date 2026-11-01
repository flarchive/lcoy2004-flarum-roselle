/*
 * 将文本复制到剪贴板，并返回是否成功。
 * Clipboard API 只在安全上下文中存在；在它之外（本地网络中的 http）
 * 使用带临时字段的旧 execCommand。
 */
function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  field.remove();

  return copied;
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text)
    );
  }

  return Promise.resolve(legacyCopy(text));
}
