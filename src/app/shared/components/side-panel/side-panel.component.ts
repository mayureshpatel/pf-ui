import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';

/**
 * The docked panel beside the transaction list. It provides the heading, Close, Delete and Save
 * chrome and projects the form (single or bulk) as its body. On narrow screens it covers the page
 * as a full-screen sheet.
 */
@Component({
  selector: 'app-side-panel',
  standalone: true,
  templateUrl: './side-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePanelComponent {
  readonly title: InputSignal<string> = input.required<string>();
  readonly saving: InputSignal<boolean> = input<boolean>(false);
  readonly valid: InputSignal<boolean> = input<boolean>(true);
  readonly saveLabel: InputSignal<string> = input<string>('Save changes');
  readonly showDelete: InputSignal<boolean> = input<boolean>(false);

  /** Whether to render the Save and Delete footer (a summary view has its own buttons). */
  readonly showFooter: InputSignal<boolean> = input<boolean>(true);

  /** Whether to render the Close button (the always-present overview has nothing to close). */
  readonly showClose: InputSignal<boolean> = input<boolean>(true);

  /** When false the panel is a normal block on narrow screens instead of a full-screen sheet. */
  readonly sheet: InputSignal<boolean> = input<boolean>(true);

  /** When false the panel never takes focus on creation or gives it back on destroy. */
  readonly moveFocus: InputSignal<boolean> = input<boolean>(true);

  readonly save: OutputEmitterRef<void> = output<void>();
  readonly closePanel: OutputEmitterRef<void> = output<void>();
  readonly delete: OutputEmitterRef<void> = output<void>();

  /**
   * Closes the panel on Escape unless a widget inside it (the merchant suggestions, the date
   * picker) already used the key to dismiss its own overlay.
   */
  onEscape(event: Event): void {
    if (!event.defaultPrevented) {
      this.closePanel.emit();
    }
  }

  /** Moves focus to the panel (a host that keeps the panel mounted calls this on mode changes). */
  focus(): void {
    this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus();
  }

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);

  /** Whatever had focus when the panel opened (usually the row that was clicked). */
  private readonly previouslyFocused: HTMLElement | null =
    document.activeElement as HTMLElement | null;

  constructor() {
    // move focus into the panel once it exists, and hand it back when the panel goes away
    afterNextRender((): void => {
      if (this.moveFocus()) this.focus();
    });
    inject(DestroyRef).onDestroy((): void => {
      if (this.moveFocus()) this.previouslyFocused?.focus?.();
    });
  }
}
