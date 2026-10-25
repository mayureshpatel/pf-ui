import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ExploreRow, GroupBy, Measure, SortKey } from '../../models/reports.model';
import {
  changeText,
  formatMeasure,
  GROUP_LABELS,
  isAdditive,
  isDrillable,
  MEASURE_LABELS,
  Tone,
  topWithOther,
} from '../../utils/explore-helpers';
import { TIME_GROUPINGS } from '../../utils/explore-state';

const TOP_ROWS = 10;

interface RowView {
  row: ExploreRow;
  id: string;
  value: string;
  /** Bar width and the comparison tick's position, as percentages of the largest value shown. */
  width: number;
  tick: number | null;
  change: { text: string; tone: Tone } | null;
}

/**
 * The results as a table of rows (cards on a phone): name, a bar with a tick for the comparison, the
 * measure, the change against the comparison, and a count. Clicking a row drills into it; its menu also
 * offers "filter and keep grouping" and "open transactions". Searching, sorting and the top-10-plus-Other
 * fold happen here; the host owns the state and does the drilling.
 */
@Component({
  selector: 'app-results-table',
  standalone: true,
  imports: [FormsModule, SelectModule],
  templateUrl: './results-table.component.html',
  host: { '(document:click)': 'onDocumentClick($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsTableComponent {
  readonly rows: InputSignal<ExploreRow[]> = input.required<ExploreRow[]>();
  readonly measure: InputSignal<Measure> = input.required<Measure>();
  readonly sort: InputSignal<SortKey> = input.required<SortKey>();
  readonly search: InputSignal<string> = input.required<string>();
  readonly expandedOther: InputSignal<boolean> = input.required<boolean>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();
  readonly groupBy: InputSignal<GroupBy> = input.required<GroupBy>();
  /** The first column's heading ("Category", "Merchant", ...). */
  readonly groupLabel: InputSignal<string> = input.required<string>();

  readonly drill: OutputEmitterRef<ExploreRow> = output<ExploreRow>();
  readonly filterOnly: OutputEmitterRef<ExploreRow> = output<ExploreRow>();
  readonly openTransactions: OutputEmitterRef<ExploreRow> = output<ExploreRow>();
  readonly sortChange: OutputEmitterRef<SortKey> = output<SortKey>();
  readonly searchChange: OutputEmitterRef<string> = output<string>();
  readonly toggleOther: OutputEmitterRef<void> = output<void>();

  /** The id of the row whose menu is open. */
  protected readonly openMenu: WritableSignal<string | null> = signal(null);

  protected readonly drillable: Signal<boolean> = computed((): boolean =>
    isDrillable(this.groupBy()),
  );
  protected readonly timeBased: Signal<boolean> = computed(
    (): boolean => TIME_GROUPINGS.includes(this.groupBy()) || this.groupBy() === 'DAY_OF_WEEK',
  );
  protected readonly currentLabel: Signal<string> = computed(
    (): string => GROUP_LABELS[this.groupBy()],
  );
  protected readonly measureLabel: Signal<string> = computed(
    (): string => MEASURE_LABELS[this.measure()],
  );
  protected readonly sortOptions: Signal<{ value: SortKey; label: string }[]> = computed(() => [
    { value: 'value' as SortKey, label: this.measureLabel() },
    { value: 'change' as SortKey, label: 'Change' },
    { value: 'name' as SortKey, label: this.timeBased() ? 'Date' : 'Name' },
    { value: 'count' as SortKey, label: 'Count' },
  ]);
  protected readonly showChange: Signal<boolean> = computed((): boolean =>
    this.rows().some((r: ExploreRow) => r.comparisonValue !== null),
  );

  private readonly ordered: Signal<ExploreRow[]> = computed((): ExploreRow[] => {
    const needle: string = this.search().trim().toLowerCase();
    const matching: ExploreRow[] = needle
      ? this.rows().filter((r: ExploreRow) => r.label.toLowerCase().includes(needle))
      : [...this.rows()];
    return matching.sort(this.comparator());
  });

  private readonly top: Signal<ReturnType<typeof topWithOther>> = computed(() =>
    topWithOther(this.ordered(), TOP_ROWS, this.expandedOther(), isAdditive(this.measure())),
  );

  protected readonly views: Signal<RowView[]> = computed((): RowView[] => {
    const measure: Measure = this.measure();
    const shown: ExploreRow[] = this.top().rows;
    const largest: number = Math.max(
      ...this.rows().map((r: ExploreRow) => Math.abs(r.value ?? 0)),
      ...this.rows().map((r: ExploreRow) => Math.abs(r.comparisonValue ?? 0)),
      0,
    );
    const percent = (value: number | null): number =>
      largest === 0 ? 0 : (Math.abs(value ?? 0) / largest) * 100;
    return shown.map((row: ExploreRow): RowView => ({
      row,
      id: row.key ?? 'none',
      value: formatMeasure(measure, row.value),
      width: percent(row.value),
      tick: row.comparisonValue === null ? null : percent(row.comparisonValue),
      change:
        this.showChange() && row.comparisonValue !== null
          ? changeText(row.value, row.comparisonValue, measure)
          : null,
    }));
  });

  protected readonly other: Signal<ExploreRow | null> = computed(
    (): ExploreRow | null => this.top().other,
  );
  protected readonly otherValue: Signal<string> = computed((): string =>
    formatMeasure(this.measure(), this.other()?.value),
  );
  protected readonly hiddenCount: Signal<number> = computed((): number => this.top().hiddenCount);

  private comparator(): (a: ExploreRow, b: ExploreRow) => number {
    const byValue = (a: ExploreRow, b: ExploreRow): number =>
      (b.value ?? Number.NEGATIVE_INFINITY) - (a.value ?? Number.NEGATIVE_INFINITY) ||
      a.label.localeCompare(b.label);
    switch (this.sort()) {
      case 'change':
        return (a, b): number =>
          (b.value ?? 0) - (b.comparisonValue ?? 0) - ((a.value ?? 0) - (a.comparisonValue ?? 0)) ||
          byValue(a, b);
      case 'count':
        return (a, b): number => b.count - a.count || byValue(a, b);
      case 'name':
        return this.timeBased()
          ? (a, b): number => (a.key ?? '').localeCompare(b.key ?? '', undefined, { numeric: true })
          : (a, b): number => a.label.localeCompare(b.label);
      default:
        return byValue;
    }
  }

  protected onSearch(value: string): void {
    this.searchChange.emit(value);
  }

  protected toggleMenu(id: string): void {
    this.openMenu.update((open: string | null) => (open === id ? null : id));
  }

  protected act(action: 'drill' | 'filterOnly' | 'openTransactions', row: ExploreRow): void {
    this.openMenu.set(null);
    this[action].emit(row);
  }

  protected onDocumentClick(event: Event): void {
    if (this.openMenu() && !(event.target as Element | null)?.closest('[data-menu-root]')) {
      this.openMenu.set(null);
    }
  }
}
