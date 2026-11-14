/**
 * Where focus goes once a Clear filters or Show all time button has removed itself: the search box
 * on a device with a fine pointer, so a keyboard user carries on typing; the results region on a
 * touch device, where focusing a text field would open the on-screen keyboard unasked.
 *
 * @param root - The screen's host element.
 */
export function focusAfterClear(root: HTMLElement): void {
  const touch: boolean = window.matchMedia('(pointer: coarse)').matches;
  const target: HTMLElement | null = touch
    ? root.querySelector<HTMLElement>('[data-focus-results]')
    : root.querySelector<HTMLInputElement>('input[type="search"]');
  target?.focus();
}
