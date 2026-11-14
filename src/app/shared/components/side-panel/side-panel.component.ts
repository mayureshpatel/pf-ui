import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';

/**
 * Hosts of the app's global overlays. They sit beside the router outlet, and the panel's own
 * Delete confirmation renders inside one, so they must stay reachable while the sheet is open.
 */
const OVERLAY_HOSTS = 'p-toast, p-confirmdialog';

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

  /** True from the `lg` breakpoint up, where the panel docks beside the list instead of covering it. */
  private readonly wide: WritableSignal<boolean> = signal(false);

  /** On a narrow screen the sheet covers the page, so it behaves as a modal dialog. */
  protected readonly modal: Signal<boolean> = computed((): boolean => this.sheet() && !this.wide());

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
    const query: MediaQueryList = window.matchMedia('(min-width: 1024px)');
    this.wide.set(query.matches);
    const onChange = (event: MediaQueryListEvent): void => this.wide.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy((): void => query.removeEventListener('change', onChange));

    // while the sheet covers the page, nothing behind it can be reached by keyboard or screen reader
    effect((onCleanup): void => {
      if (this.modal()) onCleanup(this.makeOutsideInert());
    });

    // move focus into the panel once it exists, and hand it back when the panel goes away
    afterNextRender((): void => {
      if (this.moveFocus()) this.focus();
    });
    inject(DestroyRef).onDestroy((): void => {
      if (this.moveFocus()) this.previouslyFocused?.focus?.();
    });
  }

  /**
   * Marks everything outside the panel, up to the page root, as inert and returns the undo. The walk
   * stops below `body`, so overlays a widget in the panel appends to `body` (a date picker, the
   * suggestions) stay usable.
   */
  private makeOutsideInert(): () => void {
    const marked: HTMLElement[] = [];
    let node: HTMLElement | null = this.host.nativeElement;
    while (node?.parentElement && node.parentElement !== document.body) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (
          sibling !== node &&
          sibling instanceof HTMLElement &&
          !sibling.hasAttribute('inert') &&
          !sibling.matches(OVERLAY_HOSTS)
        ) {
          sibling.setAttribute('inert', '');
          marked.push(sibling);
        }
      }
      node = node.parentElement;
    }
    return (): void =>
      marked.forEach((element: HTMLElement): void => element.removeAttribute('inert'));
  }
}
