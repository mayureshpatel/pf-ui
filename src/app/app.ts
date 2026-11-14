import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule, RestoreFocusOnHideDirective],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /**
   * PrimeNG's confirm dialog sets role="alertdialog" on its always-present `<p-dialog>` host as
   * well as on the visible container, and only the container is named (aria-labelledby the
   * header). The host is a plain wrapper, so strip its role; otherwise it is an unnamed dialog
   * (Lighthouse `aria-dialog-name`) on every page.
   */
  protected readonly confirmDialogPt = {
    host: { role: 'presentation' },
    // PF-945: the header close button has no accessible name and the confirm dialog exposes no
    // input for one, so name it through the pass-through.
    pcCloseButton: { root: { 'aria-label': 'Close' } },
  };

  /**
   * PF-898: a long confirmation message otherwise grows the dialog to the full screen width, edge
   * to edge on a phone. PF-945: it also grew to about 1000px on a desktop for a one-line sentence
   * while a short one stayed 350px, so the width is fixed at 28rem and the max width keeps it
   * inside a narrow viewport. (`breakpoints` cannot do this: PrimeNG's confirm dialog writes its
   * breakpoint rules for an attribute its inner dialog never gets.)
   */
  protected readonly confirmDialogStyle = { width: '28rem', maxWidth: 'calc(100vw - 2rem)' };

  /** PF-945: sits just under the 4rem header (see app.html). */
  protected readonly toastStyle = { top: '4.75rem' };

  /** PF-945: below 480px the 25rem toast overhung the left edge by 45px; span the viewport. */
  protected readonly toastBreakpoints = { '480px': { width: 'calc(100vw - 2rem)' } };
}
