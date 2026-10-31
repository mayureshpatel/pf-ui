import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { Transaction, TransactionType } from '@models/transaction.model';
import { FormatTransactionTypeAmountPipe } from '@shared/pipes/format-transaction-type-amount.pipe';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { DayGroup, groupByDay } from '../../utils/transaction-day-groups';

/** A sortable column header. */
interface SortColumn {
  field: string;
  label: string;
  /** Hidden below the `sm` breakpoint so Merchant, Category and Amount fit a phone. */
  hideOnPhone?: boolean;
}

/**
 * The transaction table: day groups with daily totals when sorted by date, a flat list otherwise,
 * row selection (including shift-click ranges), sortable headers, and the in-place "Choose
 * category" pill. It renders what it is given; the host owns paging, loading and persistence.
 */
@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [FormatTransactionTypeAmountPipe, FormatCurrencyPipe],
  providers: [FormatCurrencyPipe],
  templateUrl: './transaction-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionListComponent {
  readonly transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();
  readonly sort: InputSignal<string> = input.required<string>();
  readonly page: InputSignal<number> = input.required<number>();
  readonly pageCount: InputSignal<number> = input.required<number>();
  readonly selectedIds: InputSignal<number[]> = input.required<number[]>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();

  /** Hides the Description and Tags columns, for when the edit panel narrows the list. */
  readonly compact: InputSignal<boolean> = input<boolean>(false);

  /** Emits the sort string (for example `amount,desc`). */
  readonly sortChange: OutputEmitterRef<string> = output<string>();

  /** Emits the complete new selection. */
  readonly selectionChange: OutputEmitterRef<number[]> = output<number[]>();

  /** Emits the transaction the user wants to open in the edit panel. */
  readonly openTransaction: OutputEmitterRef<Transaction> = output<Transaction>();

  /** Emits the transaction whose "Choose category" pill was clicked. */
  readonly pickCategory: OutputEmitterRef<Transaction> = output<Transaction>();

  readonly TransactionType = TransactionType;

  readonly columns: SortColumn[] = [
    { field: 'description', label: 'Description', hideOnPhone: true },
    { field: 'category.name', label: 'Category' },
    { field: 'account.name', label: 'Account', hideOnPhone: true },
    { field: 'amount', label: 'Amount' },
  ];

  readonly sortField: Signal<string> = computed((): string => this.sort().split(',')[0]);
  readonly sortDirection: Signal<'asc' | 'desc'> = computed((): 'asc' | 'desc' =>
    this.sort().split(',')[1] === 'asc' ? 'asc' : 'desc',
  );
  readonly grouped: Signal<boolean> = computed((): boolean => this.sortField() === 'date');

  /** The rows as day groups, or one unlabelled group in flat mode. */
  readonly groups: Signal<DayGroup[]> = computed((): DayGroup[] => {
    if (this.grouped()) {
      return groupByDay(this.transactions(), {
        today: new Date(),
        page: this.page(),
        pageCount: this.pageCount(),
      });
    }
    return [{ key: 'flat', label: '', net: 0, partial: false, transactions: this.transactions() }];
  });

  readonly allSelected: Signal<boolean> = computed(
    (): boolean =>
      this.transactions().length > 0 && this.transactions().every((t) => this.isSelected(t.id)),
  );

  /** Some, but not all, of the rows on this page are selected (the header checkbox goes mixed). */
  readonly someSelected: Signal<boolean> = computed(
    (): boolean => !this.allSelected() && this.transactions().some((t) => this.isSelected(t.id)),
  );

  readonly skeletonRows: number[] = [0, 1, 2, 3, 4, 5, 6, 7];

  /** The sortable columns currently shown (Description hides in compact mode). */
  readonly visibleColumns: Signal<SortColumn[]> = computed((): SortColumn[] =>
    this.columns.filter((c: SortColumn): boolean => !(this.compact() && c.field === 'description')),
  );

  /** How many columns the table has right now (for full-width headings and skeleton rows). */
  readonly columnCount: Signal<number> = computed(
    (): number => 5 + (this.compact() ? 0 : 2) + (this.grouped() ? 0 : 1),
  );

  private lastClickedIndex: number | null = null;
  private readonly currency: FormatCurrencyPipe = new FormatCurrencyPipe();

  constructor() {
    // the anchor is an index into the loaded page, so a new page, sort or filter invalidates it
    effect((): void => {
      this.transactions();
      this.lastClickedIndex = null;
    });
  }

  /** Accessible name of a row checkbox: enough to tell rows with the same merchant apart. */
  rowLabel(txn: Transaction): string {
    const name: string = txn.merchant?.name ?? txn.description;
    return `Select ${name}, ${this.currency.transform(txn.amount)}, ${txn.date.substring(0, 10)}`;
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  isTransfer(txn: Transaction): boolean {
    return (
      txn.type === TransactionType.TRANSFER ||
      txn.type === TransactionType.TRANSFER_IN ||
      txn.type === TransactionType.TRANSFER_OUT
    );
  }

  /** Sorts by a column: toggles direction on the active one, starts descending on a new one. */
  onSort(field: string): void {
    const direction: string =
      field === this.sortField() ? (this.sortDirection() === 'desc' ? 'asc' : 'desc') : 'desc';
    this.sortChange.emit(`${field},${direction}`);
  }

  /** Returns to the date-grouped view, newest first. */
  onShowByDate(): void {
    this.sortChange.emit('date,desc');
  }

  /** Flips the date order while staying grouped. */
  onToggleDateOrder(): void {
    this.sortChange.emit(`date,${this.sortDirection() === 'desc' ? 'asc' : 'desc'}`);
  }

  /** Handles a row checkbox, including shift-click ranges across the loaded page. */
  onRowCheckbox(index: number, event: MouseEvent): void {
    const rows: Transaction[] = this.transactions();
    const id: number = rows[index].id;
    const current: number[] = this.selectedIds();

    if (event.shiftKey && this.lastClickedIndex !== null) {
      const from: number = Math.min(this.lastClickedIndex, index);
      const to: number = Math.max(this.lastClickedIndex, index);
      const range: number[] = rows.slice(from, to + 1).map((t) => t.id);
      this.selectionChange.emit([...new Set([...current, ...range])]);
    } else {
      this.selectionChange.emit(
        current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      );
    }
    this.lastClickedIndex = index;
  }

  /** Selects the whole loaded page, or clears the selection when it is already complete. */
  onHeaderCheckbox(): void {
    this.selectionChange.emit(this.allSelected() ? [] : this.transactions().map((t) => t.id));
  }

  onPickCategory(txn: Transaction, event: Event): void {
    event.stopPropagation();
    this.pickCategory.emit(txn);
  }

  /** Index of a row in the flat loaded page (for shift-click ranges). */
  indexOf(txn: Transaction): number {
    return this.transactions().indexOf(txn);
  }
}
