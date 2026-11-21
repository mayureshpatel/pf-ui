import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  linkedSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { TransactionDescription } from '@models/merchant.model';
import { isMovingLink } from '../../utils/merchant-helpers';

/**
 * The panel's link-descriptions mode: a searchable list of the user's real transaction
 * descriptions to tick and link to one merchant. It loads nothing itself; the host feeds it rows and
 * reacts to search, toggle, show-more and link. Ticks are kept here by description text so they
 * survive new pages of rows, searches and the Unlinked only toggle.
 */
@Component({
  selector: 'app-description-picker',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './description-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescriptionPickerComponent {
  readonly targetName: InputSignal<string> = input.required<string>();
  readonly targetId: InputSignal<number | null> = input.required<number | null>();
  readonly rows: InputSignal<TransactionDescription[]> = input.required<TransactionDescription[]>();
  readonly totalRecords: InputSignal<number> = input.required<number>();
  readonly loading: InputSignal<boolean> = input<boolean>(false);
  readonly linking: InputSignal<boolean> = input<boolean>(false);
  /** Descriptions whose link just failed: they stay ticked and every other tick is cleared. */
  readonly failed: InputSignal<string[]> = input<string[]>([]);
  readonly initialUnlinkedOnly: InputSignal<boolean> = input<boolean>(false);
  /** How many descriptions in all are still not linked to any merchant, when known. */
  readonly unlinkedLeft: InputSignal<number | null> = input<number | null>(null);
  /** True when the last load of rows failed, so an empty list is not read as "nothing left". */
  readonly loadFailed: InputSignal<boolean> = input<boolean>(false);
  /** False when Back lands on the overview (no merchant was open), so the label says so. */
  readonly backToTarget: InputSignal<boolean> = input<boolean>(true);

  readonly searchChange: OutputEmitterRef<string> = output<string>();
  readonly unlinkedOnlyChange: OutputEmitterRef<boolean> = output<boolean>();
  readonly showMore: OutputEmitterRef<void> = output<void>();
  readonly link: OutputEmitterRef<string[]> = output<string[]>();
  /** Emits when the user goes back to the merchant (named so it is not a DOM event like cancel). */
  readonly back: OutputEmitterRef<void> = output<void>();
  readonly retryLoad: OutputEmitterRef<void> = output<void>();

  readonly unlinkedOnly: WritableSignal<boolean> = linkedSignal((): boolean =>
    this.initialUnlinkedOnly(),
  );
  readonly search: WritableSignal<string> = signal('');
  readonly ticked: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());

  readonly tickedCount: Signal<number> = computed((): number => this.ticked().size);
  readonly canShowMore: Signal<boolean> = computed(
    (): boolean => this.rows().length < this.totalRecords(),
  );
  readonly linkLabel: Signal<string> = computed((): string => {
    if (this.linking()) return 'Linking…';
    const count: number = this.tickedCount();
    if (count === 0) return 'Link descriptions';
    return count === 1 ? 'Link 1 description' : `Link ${count} descriptions`;
  });
  /** The rows that can be ticked: one already linked to this merchant has nothing left to do. */
  readonly selectableRows: Signal<TransactionDescription[]> = computed(
    (): TransactionDescription[] =>
      this.rows().filter((row: TransactionDescription): boolean => !this.alreadyLinkedHere(row)),
  );
  readonly allSelected: Signal<boolean> = computed(
    (): boolean =>
      this.selectableRows().length > 0 &&
      this.selectableRows().every((row: TransactionDescription): boolean =>
        this.ticked().has(row.description),
      ),
  );
  readonly selectAllLabel: Signal<string> = computed((): string => {
    const count: number = this.selectableRows().length;
    if (this.allSelected()) return 'Clear selection';
    return count === 1 ? 'Select the 1 shown' : `Select all ${count} shown`;
  });
  /** Where the user is in the backlog: how many are shown, and how many are still unlinked. */
  readonly progressText: Signal<string> = computed((): string => {
    const parts: string[] = [];
    if (this.rows().length > 0) parts.push(`${this.rows().length} of ${this.totalRecords()} shown`);
    const left: number | null = this.unlinkedLeft();
    if (left !== null) parts.push(`${left} not linked yet`);
    return parts.join(' · ');
  });
  readonly emptyMessage: Signal<string> = computed((): string =>
    this.unlinkedOnly() && this.search().trim() === ''
      ? 'Every description is linked.'
      : 'No descriptions match',
  );

  constructor() {
    effect((): void => {
      const failed: string[] = this.failed();
      if (failed.length === 0) return;
      untracked((): void => this.ticked.set(new Set(failed)));
    });
  }

  moving(row: TransactionDescription): boolean {
    return isMovingLink(row, this.targetId());
  }

  alreadyLinkedHere(row: TransactionDescription): boolean {
    return row.merchantId !== null && row.merchantId === this.targetId();
  }

  usage(row: TransactionDescription): string {
    return row.transactionCount === 1 ? '1 transaction' : `${row.transactionCount} transactions`;
  }

  toggleTick(description: string): void {
    const next: Set<string> = new Set<string>(this.ticked());
    if (next.has(description)) next.delete(description);
    else next.add(description);
    this.ticked.set(next);
  }

  /** Ticks every shown description that can be linked, or clears them all when they already are. */
  toggleSelectAll(): void {
    const next: Set<string> = new Set<string>(this.ticked());
    if (this.allSelected()) {
      this.selectableRows().forEach((row: TransactionDescription): void => {
        next.delete(row.description);
      });
    } else {
      this.selectableRows().forEach((row: TransactionDescription): void => {
        next.add(row.description);
      });
    }
    this.ticked.set(next);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.searchChange.emit(value);
  }

  toggleUnlinkedOnly(): void {
    const next = !this.unlinkedOnly();
    this.unlinkedOnly.set(next);
    this.unlinkedOnlyChange.emit(next);
  }

  submit(): void {
    if (this.tickedCount() === 0 || this.linking()) return;
    this.link.emit([...this.ticked()]);
  }
}
