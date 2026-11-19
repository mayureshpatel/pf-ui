import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Arrow-key navigation for a row or grid of toggle buttons that is a single tab stop: the buttons
 * carry `tabindex` 0 (the selected one, or the first when none is) or -1, and the arrow keys, Home
 * and End move focus among them. Moving focus never changes the selection.
 *
 * Put it on the container: `<div appRovingFocus>`.
 */
@Directive({
  selector: '[appRovingFocus]',
  standalone: true,
  host: { '(keydown)': 'onKeydown($event)' },
})
export class RovingFocusDirective {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);

  onKeydown(event: KeyboardEvent): void {
    const keys: string[] = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons: HTMLElement[] = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('button'),
    );
    const current: number = buttons.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (current + 1) % buttons.length;
    } else next = (current - 1 + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  }
}
