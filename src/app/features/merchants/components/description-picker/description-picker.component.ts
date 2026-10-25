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

  readonly searchChange: OutputEmitterRef<string> = output<string>();
  readonly unlinkedOnlyChange: OutputEmitterRef<boolean> = output<boolean>();
  readonly showMore: OutputEmitterRef<void> = output<void>();
  readonly link: OutputEmitterRef<string[]> = output<string[]>();
  /** Emits when the user goes back to the merchant (named so it is not a DOM event like cancel). */
  readonly back: OutputEmitterRef<void> = output<void>();

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
