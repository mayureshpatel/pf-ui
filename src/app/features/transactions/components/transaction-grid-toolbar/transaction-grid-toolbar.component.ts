import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  signal,
  Signal,
  WritableSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { Transaction, TransactionType } from '@models/transaction.model';
import { GridHighlights, NO_HIGHLIGHTS } from '../../utils/grid-highlights';

/**
 * The strip of controls directly above the transactions grid, whose functions act on the grid
 * (PF-923). It holds the Create rule button and the row highlight switches (PF-924). Create rule
 * starts one rule for the ticked rows, so it is disabled, with a visible hint, until a row is
 * ticked. The highlight switches combine and are owned by the page, which passes them back in.
 */
@Component({
  selector: 'app-transaction-grid-toolbar',
  standalone: true,
  templateUrl: './transaction-grid-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionGridToolbarComponent {
  /** How many rows are ticked; Create rule needs at least one. */
  readonly selectionCount: InputSignal<number> = input.required<number>();

  /** Which highlights are on. */
  readonly highlights: InputSignal<GridHighlights> = input<GridHighlights>(NO_HIGHLIGHTS);

  /** The rows on this page, used to say how many each active highlight touches. */
  readonly transactions: InputSignal<Transaction[]> = input<Transaction[]>([]);

  /** Whether the tools are open on a phone (they are always open from the lg breakpoint up). */
  readonly toolsOpen: WritableSignal<boolean> = signal(false);

  readonly highlightOptions: { key: keyof GridHighlights; label: string; testId: string }[] = [
    { key: 'noCategory', label: 'No category', testId: 'toolbar-highlight-no-category' },
    { key: 'noMerchant', label: 'No merchant', testId: 'toolbar-highlight-no-merchant' },
    { key: 'ruleCovers', label: 'Rule covers it', testId: 'toolbar-highlight-rule-covers' },
  ];

  /** Rows on this page each highlight touches; null where it cannot be counted here. */
  readonly counts: Signal<Record<keyof GridHighlights, number | null>> = computed(() => {
    const rows: Transaction[] = this.transactions();
    const isTransfer = (txn: Transaction): boolean =>
      txn.type === TransactionType.TRANSFER ||
      txn.type === TransactionType.TRANSFER_IN ||
      txn.type === TransactionType.TRANSFER_OUT;
    return {
      noCategory: rows.filter((txn) => !txn.category && !isTransfer(txn)).length,
      noMerchant: rows.filter((txn) => !txn.merchant).length,
      ruleCovers: null,
    };
  });

  /** Emits the complete new highlights whenever a switch is toggled. */
  readonly highlightsChange: OutputEmitterRef<GridHighlights> = output<GridHighlights>();

  /** Starts one rule for the ticked rows (the page decides the keyword and the panel). */
  readonly createRule: OutputEmitterRef<void> = output<void>();

  /** Emits only when rows are ticked, so a disabled-looking click can never start a rule. */
  onCreateRule(): void {
    if (this.selectionCount() > 0) {
      this.createRule.emit();
    }
  }

  /** Flips one highlight, keeping the others as they are. */
  toggle(key: keyof GridHighlights): void {
    this.highlightsChange.emit({ ...this.highlights(), [key]: !this.highlights()[key] });
  }
}
