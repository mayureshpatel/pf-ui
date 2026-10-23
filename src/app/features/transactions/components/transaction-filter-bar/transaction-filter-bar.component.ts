import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { Popover } from 'primeng/popover';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectItemGroup } from 'primeng/api';
import { TransactionFilter, TransactionType } from '@models/transaction.model';
import {
  buildFilterChips,
  FilterChip,
  removeFilterChip,
} from '../../utils/transaction-filter-chips';
import { detectPreset, PeriodPreset, presetRange } from '../../utils/transaction-period';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The search and filter controls above the transaction list: period buttons, a debounced search
 * box, a Filters popover, removable chips for what is applied, and a result line. It never
 * mutates the filter it is given; every change emits a complete new filter.
 */
@Component({
  selector: 'app-transaction-filter-bar',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DatePicker,
    InputNumberModule,
    Popover,
    SelectModule,
    SelectButtonModule,
  ],
  templateUrl: './transaction-filter-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFilterBarComponent {
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** The current filter, including the period (start and end date) and the search text. */
  readonly filter: InputSignal<TransactionFilter> = input.required<TransactionFilter>();
  readonly accounts: InputSignal<{ id: number; name: string }[]> =
    input.required<{ id: number; name: string }[]>();
  readonly tags: InputSignal<{ id: number; name: string }[]> =
    input.required<{ id: number; name: string }[]>();
  readonly groupedCategories: InputSignal<SelectItemGroup<string>[]> =
    input.required<SelectItemGroup<string>[]>();
  readonly merchantNames: InputSignal<string[]> = input.required<string[]>();

  /** Total matches for the current view, or null while it is not known. */
  readonly resultCount: InputSignal<number | null> = input.required<number | null>();

  /** Emits the complete new filter after any change. */
  readonly filterChange: OutputEmitterRef<TransactionFilter> = output<TransactionFilter>();

  readonly presetOptions: { label: string; value: PeriodPreset }[] = [
    { label: 'This month', value: 'THIS_MONTH' },
    { label: 'Last month', value: 'LAST_MONTH' },
    { label: 'This year', value: 'THIS_YEAR' },
    { label: 'All time', value: 'ALL_TIME' },
    { label: 'Custom range', value: 'CUSTOM' },
  ];

  readonly typeOptions: { label: string; value: TransactionType }[] = [
    { label: 'Income', value: TransactionType.INCOME },
    { label: 'Expense', value: TransactionType.EXPENSE },
    { label: 'Transfer', value: TransactionType.TRANSFER },
    { label: 'Adjustment', value: TransactionType.ADJUSTMENT },
  ];

  /** Whether the user chose Custom range from the buttons (the pickers then stay visible). */
  private customChosen = false;

  readonly preset: Signal<PeriodPreset> = computed((): PeriodPreset => {
    const detected: PeriodPreset = detectPreset(this.filter(), new Date());
    return this.customChosen && detected === 'ALL_TIME' ? 'CUSTOM' : detected;
  });

  readonly chips: Signal<FilterChip[]> = computed((): FilterChip[] =>
    buildFilterChips(this.filter(), { accounts: this.accounts(), tags: this.tags() }),
  );

  /** How many applied filters the Filters button should report (an amount range counts as one). */
  readonly appliedCount: Signal<number> = computed((): number => this.chips().length);

  constructor() {
    this.destroyRef.onDestroy((): void => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
  }

  /** Applies a period preset (or reveals the custom pickers). */
  onPresetChange(preset: PeriodPreset | null): void {
    if (!preset) return;
    this.customChosen = preset === 'CUSTOM';
    if (preset === 'CUSTOM') {
      this.filterChange.emit({ ...this.filter() });
      return;
    }
    const range = presetRange(preset, new Date());
    this.filterChange.emit({
      ...this.filter(),
      ...range,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }

  /** Applies one end of a custom date range. */
  onCustomDate(end: 'startDate' | 'endDate', value: Date | null): void {
    this.filterChange.emit({ ...this.filter(), [end]: value ?? undefined });
  }

  /** Debounces the search box, then emits the filter with the text exactly as typed. */
  onSearchInput(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout((): void => {
      this.filterChange.emit({ ...this.filter(), description: value === '' ? undefined : value });
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Removes one applied filter. */
  onRemoveChip(chip: FilterChip): void {
    this.filterChange.emit(removeFilterChip(this.filter(), chip.key));
  }

  /** Clears every filter except the period and keeps the search box empty too. */
  onClearAll(): void {
    const { startDate, endDate } = this.filter();
    this.filterChange.emit({ startDate, endDate });
  }

  /** Applies the popover's values as one change. */
  onApplyPopover(popover: Popover, draft: PopoverDraft): void {
    this.filterChange.emit({ ...this.filter(), ...draft });
    popover.hide();
  }

  /** The popover's working values; copied from the filter each time the popover opens. */
  draft: PopoverDraft = {};

  /** Seeds the popover from the filter that is currently applied. */
  onPopoverShow(): void {
    const f: TransactionFilter = this.filter();
    this.draft = {
      accountId: f.accountId,
      categoryName: f.categoryName,
      type: f.type,
      minAmount: f.minAmount,
      maxAmount: f.maxAmount,
      merchant: f.merchant,
      tagId: f.tagId,
    };
  }
}

/** The fields the Filters popover edits. */
export interface PopoverDraft {
  accountId?: number;
  categoryName?: string;
  type?: TransactionType;
  minAmount?: number;
  maxAmount?: number;
  merchant?: string;
  tagId?: number;
}
