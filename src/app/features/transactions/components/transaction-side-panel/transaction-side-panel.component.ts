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
  selector: 'app-transaction-side-panel',
  standalone: true,
  templateUrl: './transaction-side-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionSidePanelComponent {
  readonly title: InputSignal<string> = input.required<string>();
  readonly saving: InputSignal<boolean> = input<boolean>(false);
  readonly valid: InputSignal<boolean> = input<boolean>(true);
  readonly saveLabel: InputSignal<string> = input<string>('Save changes');
  readonly showDelete: InputSignal<boolean> = input<boolean>(false);

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

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);

  /** Whatever had focus when the panel opened (usually the row that was clicked). */
  private readonly previouslyFocused: HTMLElement | null =
    document.activeElement as HTMLElement | null;

  constructor() {
    // move focus into the panel once it exists, and hand it back when the panel goes away
    afterNextRender((): void => {
      this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus();
    });
    inject(DestroyRef).onDestroy((): void => this.previouslyFocused?.focus?.());
  }
}
