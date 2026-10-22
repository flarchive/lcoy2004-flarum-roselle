/*
 * Alvos de digitação: campos, selects e áreas editáveis. Os atalhos de teclado
 * do tema e os do Discourse consultam isto para não roubar uma tecla de quem
 * está escrevendo.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable]');
}
