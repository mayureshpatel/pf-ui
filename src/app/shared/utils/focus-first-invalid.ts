/**
 * Moves focus to the first invalid control inside a form's host, so a keyboard or screen-reader
 * user lands on what needs fixing after a failed submit. Angular puts `ng-invalid` on each control
 * (and on the form itself, which is skipped); a custom control such as `p-select` is searched for
 * the element that can take focus.
 *
 * @param root - The host element of the form.
 */
export function focusFirstInvalid(root: HTMLElement): void {
  const invalid: HTMLElement | undefined = Array.from(
    root.querySelectorAll<HTMLElement>('.ng-invalid'),
  ).find((element: HTMLElement): boolean => element.tagName !== 'FORM');
  if (!invalid) return;
  const target: HTMLElement | null = invalid.matches('input, button, textarea, select')
    ? invalid
    : invalid.querySelector<HTMLElement>('input, [role="combobox"], button');
  target?.focus();
}
