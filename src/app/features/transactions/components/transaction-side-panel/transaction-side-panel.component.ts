import {
  ChangeDetectionStrategy,
  Component,
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
}
