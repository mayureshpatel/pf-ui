import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal,
} from '@angular/core';

/**
 * A toast with an Undo button (PF-928), shown after a rule is created and applied. It dismisses
 * itself after `lifeMs`, but not while the Undo button has keyboard focus or the pointer is over
 * it, and a new message starts its life over. The message sits in an always-present polite live
 * region so assistive technology announces it.
 */
@Component({
  selector: 'app-undo-toast',
  standalone: true,
  templateUrl: './undo-toast.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UndoToastComponent {
  /** The message to show; null hides the toast. */
  readonly message: InputSignal<string | null> = input.required<string | null>();

  /** How long the toast stays before dismissing itself, in milliseconds. */
  readonly lifeMs: InputSignal<number> = input<number>(10000);

  /** Emits when Undo is pressed. */
  readonly undo: OutputEmitterRef<void> = output<void>();

  /** Emits when the toast goes away by itself or its close button is pressed. */
  readonly dismissed: OutputEmitterRef<void> = output<void>();

  /** True while focus is inside or the pointer is over the toast, which holds it open. */
  protected readonly held: WritableSignal<boolean> = signal(false);

  constructor() {
    effect((onCleanup: (cleanupFn: () => void) => void): void => {
      if (this.message() === null || this.held()) return;
      const timer: ReturnType<typeof setTimeout> = setTimeout(
        (): void => this.dismissed.emit(),
        this.lifeMs(),
      );
      onCleanup((): void => clearTimeout(timer));
    });
  }

  /** Lets go of the toast unless focus only moved to another part of it. */
  protected onFocusOut(event: FocusEvent, toast: HTMLElement): void {
    if (!toast.contains(event.relatedTarget as Node | null)) {
      this.held.set(false);
    }
  }
}
