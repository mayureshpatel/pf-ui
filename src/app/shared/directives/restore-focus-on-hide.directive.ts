import { Directive, DestroyRef, DoCheck, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { Observable } from 'rxjs';

/**
 * Restores focus to whatever triggered a `p-dialog`'s (or `p-confirmDialog`'s) opening once it
 * closes, and gives the dialog's header close button an accessible name.
 *
 * PF-945: PrimeNG's dialogs ship the header X with no accessible name and take no default from the
 * locale config, so the name is set here once rather than on every `<p-dialog>`; a dialog that
 * sets its own `closeAriaLabel` keeps it. The confirm dialog is covered by the same directive
 * (`<p-confirmDialog appRestoreFocusOnHide>`), so Esc, Cancel and accept all hand focus back
 * instead of leaving it on the page body.
 *
 * `p-dialog` already handles open-focus and Tab-trapping itself (`focusOnShow`/`focusTrap`, both
 * default `true`); this directive only adds the piece it doesn't do on its own. Apply directly to
 * the `<p-dialog>` element: `<p-dialog appRestoreFocusOnHide ...>`.
 *
 * Subscribes directly to the co-located `Dialog` instance's own typed `onHide` emitter rather than
 * `@HostListener` -- a host listener for a third-party component's custom output (as opposed to a
 * native DOM event) isn't reliably type-checked against the actual host, and errors as if the
 * event were an untyped native `Event`.
 *
 * Captures the trigger element via `ngDoCheck` reading `dialog.visible` directly, not via
 * `visibleChange` -- confirmed live that `visibleChange` only fires for changes the dialog itself
 * initiates (e.g. its own close), not when a parent externally flips `visible` to open it, which
 * is how every real usage here actually opens its dialog. `ngDoCheck` correctly detects the
 * false-to-true transition regardless of which side caused it.
 */
/** The members `Dialog` and `ConfirmDialog` share that this directive reads. */
interface FocusRestoringDialog {
  visible: boolean;
  closeAriaLabel: string | undefined;
  onHide: Observable<unknown>;
}

@Directive({
  selector: '[appRestoreFocusOnHide]',
  standalone: true,
})
export class RestoreFocusOnHideDirective implements DoCheck {
  private readonly dialog: FocusRestoringDialog =
    inject(Dialog, { self: true, optional: true }) ?? inject(ConfirmDialog, { self: true });
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private triggerElement: HTMLElement | null = null;
  private wasVisible = false;

  constructor() {
    this.dialog.closeAriaLabel ??= 'Close';
    this.dialog.onHide.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((): void => {
      this.triggerElement?.focus?.();
      this.triggerElement = null;
    });
  }

  ngDoCheck(): void {
    const isVisible: boolean = this.dialog.visible;
    if (isVisible && !this.wasVisible) {
      this.triggerElement = document.activeElement as HTMLElement;
    }
    this.wasVisible = isVisible;
  }
}
