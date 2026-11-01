import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
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
  protected readonly confirmDialogPt = { host: { role: 'presentation' } };

  /**
   * PF-898: a long confirmation message otherwise grows the dialog to the full screen width, edge
   * to edge on a phone. A max width only (no fixed width) leaves wider screens content-sized as
   * before. (`breakpoints` cannot do this: PrimeNG's confirm dialog writes its breakpoint rules for
   * an attribute its inner dialog never gets.)
   */
  protected readonly confirmDialogStyle = { maxWidth: 'calc(100vw - 2rem)' };
}
