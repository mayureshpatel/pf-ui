import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  ElementRef,
  inject,
  Injector,
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
  MEASURE_BAR_CLASS,
  MEASURE_LABELS,
  Tone,
  topWithOther,
} from '../../utils/explore-helpers';
import { TIME_GROUPINGS } from '../../utils/explore-state';

const TOP_ROWS = 10;

/** The change as a fraction of its comparison, for sorting; nothing to compare against ranks last. */
function changeRank(row: ExploreRow): number {
  const base: number = Math.abs(row.comparisonValue ?? 0);
  if (row.comparisonValue === null || base === 0) return Number.NEGATIVE_INFINITY;
  return ((row.value ?? 0) - (row.comparisonValue ?? 0)) / base;
}
/** How long a touch is held before it opens the row menu. */
const LONG_PRESS_MS = 500;

interface RowView {
  row: ExploreRow;
  id: string;
  value: string;
  /** Bar width and the comparison tick's position, as percentages of the bar's scale. */
  width: number;
  tick: number | null;
  /** The share as text ("31%") beside the bar, or null when the bar is only relative. */
  share: string | null;
  /** The same for a screen reader, with the comparison. */
  shareText: string;
  negative: boolean;
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
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:pointerdown)': 'onDocumentPointerDown()',
  },
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
  /** The period's total and the comparison's, for the bar to be a true share of the total. */
  readonly total: InputSignal<number | null> = input<number | null>(null);
  readonly comparisonTotal: InputSignal<number | null> = input<number | null>(null);

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
  protected readonly barClass: Signal<string> = computed(
    (): string => MEASURE_BAR_CLASS[this.measure()],
  );
  protected readonly sortOptions: Signal<{ value: SortKey; label: string }[]> = computed(() => [
    { value: 'value' as SortKey, label: this.measureLabel() },
    // sorting by a change that is not shown would do nothing, so it is offered only with a comparison
    ...(this.showChange() || this.sort() === 'change'
      ? [{ value: 'change' as SortKey, label: 'Change' }]
      : []),
    { value: 'name' as SortKey, label: this.timeBased() ? 'Date' : 'Name' },
    { value: 'count' as SortKey, label: 'Count' },
  ]);

  /** The bar is a share of the total for the measures that add up (spending, income). */
  protected readonly shareMode: Signal<boolean> = computed(
    (): boolean =>
      (this.measure() === 'SPENDING' || this.measure() === 'INCOME') && (this.total() ?? 0) > 0,
  );
  protected readonly shareHeader: Signal<string> = computed((): string =>
    this.shareMode() ? 'Share of total' : 'Size',
  );
  protected readonly negativeBarClass = 'bg-amber-600 dark:bg-amber-400';
  protected readonly hasNegative: Signal<boolean> = computed((): boolean =>
    this.rows().some((r: ExploreRow) => (r.value ?? 0) < 0),
  );
  protected readonly legend: Signal<string> = computed((): string => {
    const parts: string[] = [
      this.shareMode() ? 'Bar: share of the total.' : 'Bar: size compared with the largest row.',
    ];
    if (this.showChange()) parts.push('The | mark is the comparison period.');
    if (this.hasNegative()) parts.push('Amber bars are negative.');
    return parts.join(' ');
  });
  /** The last rows open their menu upwards, so its last item is not pushed off the bottom of the page. */
  protected readonly flipFrom: Signal<number> = computed((): number =>
    this.views().length > 5 ? this.views().length - 3 : Number.POSITIVE_INFINITY,
  );
  protected readonly noMatch: Signal<boolean> = computed(
    (): boolean => this.search().trim() !== '' && this.ordered().length === 0,
  );
  protected readonly statusText: Signal<string> = computed((): string => {
    if (!this.search().trim()) return '';
    const n: number = this.ordered().length;
    return n === 0 ? 'No rows match.' : `${n} ${n === 1 ? 'row matches' : 'rows match'}.`;
  });
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
    const shareMode: boolean = this.shareMode();
    const total: number = this.total() ?? 0;
    const comparisonTotal: number = this.comparisonTotal() ?? 0;
    const percent = (value: number | null, of: number): number =>
      of === 0 ? 0 : Math.min(100, (Math.abs(value ?? 0) / of) * 100);
    const asText = (n: number): string => (n > 0 && n < 1 ? '<1%' : `${Math.round(n)}%`);
    return shown.map((row: ExploreRow): RowView => {
      const width: number = percent(row.value, shareMode ? total : largest);
      const tick: number | null =
        row.comparisonValue === null || (shareMode && comparisonTotal <= 0)
          ? null
          : percent(row.comparisonValue, shareMode ? comparisonTotal : largest);
      const share: string | null = shareMode ? asText(width) : null;
      return {
        row,
        id: row.key ?? 'none',
        value: formatMeasure(measure, row.value),
        width,
        tick,
        share,
        shareText: shareMode
          ? `${asText(width)} of the total${tick === null ? '' : `, comparison ${asText(tick)}`}`
          : '',
        negative: (row.value ?? 0) < 0,
        change:
          this.showChange() && row.comparisonValue !== null
            ? changeText(row.value, row.comparisonValue, measure)
            : null,
      };
    });
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
        // the percentage the column shows; a row with nothing to compare against sorts last
        return (a, b): number => changeRank(b) - changeRank(a) || byValue(a, b);
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

  protected clearSearch(): void {
    this.searchChange.emit('');
    afterNextRender(
      (): void => this.host.nativeElement.querySelector<HTMLElement>('#results-search')?.focus(),
      { injector: this.injector },
    );
  }

  protected countText(count: number): string {
    return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
  }

  /** Expanding or folding removes the button that was pressed, so focus goes to the nearest thing. */
  protected onToggleOther(): void {
    const expanding = !this.expandedOther();
    this.toggleOther.emit();
    afterNextRender(
      (): void => {
        const root: HTMLElement = this.host.nativeElement;
        const target: HTMLElement | null = expanding
          ? (root
              .querySelectorAll<HTMLElement>('[data-row]')
              [TOP_ROWS]?.querySelector<HTMLElement>('button') ?? null)
          : root.querySelector<HTMLElement>('[data-other] button');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Tabbing out of an open menu closes it (a click elsewhere already did). */
  protected onMenuFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Element | null;
    if (next && !(event.currentTarget as Element).contains(next)) this.openMenu.set(null);
  }

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** A long press just opened the menu, so the click that follows the lift must be ignored. */
  private longPressed = false;

  protected toggleMenu(id: string): void {
    if (this.openMenu() === id) {
      this.openMenu.set(null);
      return;
    }
    this.show(id);
  }

  /** Opens a row's menu and moves focus to its first item. */
  private show(id: string): void {
    this.openMenu.set(id);
    afterNextRender(
      (): void => this.host.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
      { injector: this.injector },
    );
  }

  /** Right-click on a row opens its menu instead of the browser's. */
  protected onContextMenu(event: Event, id: string): void {
    if (!this.drillable()) return;
    event.preventDefault();
    this.show(id);
  }

  /** A held touch (about half a second, not moved) opens the menu. */
  protected onPointerDown(event: Event, id: string): void {
    this.longPressed = false;
    this.cancelPress();
    if (!this.drillable() || (event as PointerEvent).pointerType !== 'touch') return;
    this.pressTimer = setTimeout((): void => {
      this.pressTimer = null;
      this.longPressed = true;
      this.show(id);
    }, LONG_PRESS_MS);
  }

  protected cancelPress(): void {
    if (this.pressTimer !== null) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  /** Arrow keys, Home and End move between the items; Escape closes and returns to the button. */
  protected onMenuKeydown(event: KeyboardEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const items: HTMLElement[] = Array.from(
      menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const at: number = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = (at + 1) % items.length;
        break;
      case 'ArrowUp':
        next = (at - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'Escape': {
        event.stopPropagation();
        const button = menu.closest('[data-menu-root]')?.querySelector<HTMLElement>('[data-menu]');
        this.openMenu.set(null);
        button?.focus();
        return;
      }
      default:
        return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  /** The text colour of a change, by whether it is good or bad news. */
  protected toneClass(tone: Tone): string {
    return tone === 'bad'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'good'
        ? 'text-primary-700 dark:text-primary-400'
        : 'text-muted-color';
  }

  protected act(action: 'drill' | 'filterOnly' | 'openTransactions', row: ExploreRow): void {
    // the click that follows a long press lifting is not a tap on the row
    if (this.longPressed) return;
    this.openMenu.set(null);
    this[action].emit(row);
  }

  /** Any new press starts afresh: a click is only the tail of a long press until the next one. */
  protected onDocumentPointerDown(): void {
    this.longPressed = false;
  }

  protected onDocumentClick(event: Event): void {
    // the click that follows a long press lifting would otherwise close the menu it just opened
    if (this.longPressed) return;
    if (this.openMenu() && !(event.target as Element | null)?.closest('[data-menu-root]')) {
      this.openMenu.set(null);
    }
  }
}
