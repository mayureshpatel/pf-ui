import { ChangeDetectionStrategy, Component, input, InputSignal, output, OutputEmitterRef } from '@angular/core';

/**
 * The floating bar that appears while transactions are selected, offering the common bulk
 * actions. Fields beyond category and the transfer toggle live in the edit panel ("Edit more").
 */
@Component({
  selector: 'app-transaction-bulk-bar',
  standalone: true,
  templateUrl: './transaction-bulk-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionBulkBarComponent {
  readonly selectionCount: InputSignal<number> = input.required<number>();

  /** True when every selected row is already a transfer, so the toggle offers Unmark. */
  readonly allTransfers: InputSignal<boolean> = input.required<boolean>();

  /** True while a bulk request is in flight. */
  readonly busy: InputSignal<boolean> = input.required<boolean>();

  readonly setCategory: OutputEmitterRef<void> = output<void>();
  readonly markTransfer: OutputEmitterRef<void> = output<void>();
  readonly unmarkTransfer: OutputEmitterRef<void> = output<void>();
  readonly editMore: OutputEmitterRef<void> = output<void>();
  readonly clear: OutputEmitterRef<void> = output<void>();
}
