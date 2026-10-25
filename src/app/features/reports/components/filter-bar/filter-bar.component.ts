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
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { DrillFilterKey, DrillStep, ExploreFilters } from '../../models/reports.model';

/** How many chips show before the rest fold into "+N more". */
export const VISIBLE_CHIPS = 4;
const NONE = 'none';
const DRILL_KIND: Partial<Record<DrillFilterKey, string>> = {
  categoryId: 'Category',
  merchantId: 'Merchant',
  accountIds: 'Account',
  tagId: 'Tag',
  period: 'Period',
};

type AddKind = 'account' | 'category' | 'merchant' | 'tag' | 'amount';

interface Chip {
  id: string;
  text: string;
  /** The drill step this chip is, or null for a filter added from the menu. */
  drillIndex: number | null;
  /** The filters with this chip removed (filter chips only). */
  without: ExploreFilters | null;
}

interface Option {
  value: number | string;
  label: string;
}

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    .format(value)
    .replace(/\.00$/, '');

/**
 * The stacked filters as removable chips (drill steps and menu-added filters in one list), the "+ Add
 * filter" menu, and the note about what the explorer leaves out. Emits the whole new filter set or the
 * index of a drill step to step back to; the host owns the state.
 */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [FormsModule, MultiSelectModule, SelectModule, CurrencyPipe],
  templateUrl: './filter-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBarComponent {
  readonly filters: InputSignal<ExploreFilters> = input.required<ExploreFilters>();
  readonly drill: InputSignal<DrillStep[]> = input.required<DrillStep[]>();
  /** Transfers and adjustments the explorer left out of the numbers. */
  readonly excluded: InputSignal<number> = input.required<number>();
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();
  readonly categories: InputSignal<Category[]> = input.required<Category[]>();
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();
  readonly tags: InputSignal<Tag[]> = input.required<Tag[]>();

  readonly filtersChange: OutputEmitterRef<ExploreFilters> = output<ExploreFilters>();
  /** The index of the drill step whose chip was removed (it and the later steps go). */
  readonly removeDrill: OutputEmitterRef<number> = output<number>();
  /** What the user typed in the merchant list's search, for the host to look up. */
  readonly merchantSearch: OutputEmitterRef<string> = output<string>();

  protected readonly expanded: WritableSignal<boolean> = signal(false);
  protected readonly addOpen: WritableSignal<boolean> = signal(false);
  protected readonly addKind: WritableSignal<AddKind | null> = signal(null);
  protected readonly minDraft: WritableSignal<string> = signal('');
  protected readonly maxDraft: WritableSignal<string> = signal('');

  protected readonly kindOptions: { value: AddKind; label: string }[] = [
    { value: 'account', label: 'Account' },
    { value: 'category', label: 'Category' },
    { value: 'merchant', label: 'Merchant' },
    { value: 'tag', label: 'Tag' },
    { value: 'amount', label: 'Amount range' },
  ];

  protected readonly categoryOptions: Signal<Option[]> = computed((): Option[] => [
    { value: NONE, label: 'Uncategorized' },
    ...this.categories().map((c: Category) => ({
      value: c.id,
      label: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
    })),
  ]);
  protected readonly merchantOptions: Signal<Option[]> = computed((): Option[] => [
    { value: NONE, label: 'No merchant' },
    ...this.merchants().map((m: Merchant) => ({ value: m.id, label: m.name })),
  ]);
  protected readonly tagOptions: Signal<Option[]> = computed((): Option[] => [
    { value: NONE, label: 'No tag' },
    ...this.tags().map((t: Tag) => ({ value: t.id, label: t.name })),
  ]);

  /** Every chip: the drill steps first, then the filters the drill doesn't already account for. */
  protected readonly chips: Signal<Chip[]> = computed((): Chip[] => {
    const filters: ExploreFilters = this.filters();
    const drill: DrillStep[] = this.drill();
    const chips: Chip[] = drill.map((step: DrillStep, index: number): Chip => ({
      id: `drill-${index}`,
      text: DRILL_KIND[step.filterKey]
        ? `${DRILL_KIND[step.filterKey]}: ${step.label}`
        : step.label,
      drillIndex: index,
      without: null,
    }));
    const lastStep = (key: DrillFilterKey): DrillStep | undefined =>
      [...drill].reverse().find((s: DrillStep) => s.filterKey === key);
    const filterChip = (id: string, text: string, without: Partial<ExploreFilters>): void => {
      chips.push({ id, text, drillIndex: null, without: { ...filters, ...without } });
    };

    if (filters.accountIds.length && !this.coveredAccount(lastStep('accountIds'), filters)) {
      const names: string = filters.accountIds.map((id: number) => this.accountName(id)).join(', ');
      filterChip(
        'accounts',
        `${filters.accountIds.length > 1 ? 'Accounts' : 'Account'}: ${names}`,
        { accountIds: [] },
      );
    }
    if (filters.categoryId !== undefined && lastStep('categoryId')?.value !== filters.categoryId) {
      filterChip('category', `Category: ${this.categoryName(filters)}`, {
        categoryId: undefined,
        categoryName: undefined,
      });
    }
    if (filters.uncategorized && !lastStep('uncategorized')) {
      filterChip('uncategorized', 'Uncategorized', { uncategorized: undefined });
    }
    if (filters.merchantId !== undefined && lastStep('merchantId')?.value !== filters.merchantId) {
      filterChip('merchant', `Merchant: ${this.merchantName(filters)}`, {
        merchantId: undefined,
        merchantName: undefined,
      });
    }
    if (filters.noMerchant && !lastStep('noMerchant')) {
      filterChip('noMerchant', 'No merchant', { noMerchant: undefined });
    }
    if (filters.tagId !== undefined && lastStep('tagId')?.value !== filters.tagId) {
      filterChip('tag', `Tag: ${this.tagName(filters.tagId)}`, { tagId: undefined });
    }
    if (filters.noTag && !lastStep('noTag')) {
      filterChip('noTag', 'No tag', { noTag: undefined });
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      filterChip('amount', `Amount: ${this.amountText(filters)}`, {
        minAmount: undefined,
        maxAmount: undefined,
      });
    }
    return chips;
  });

  protected readonly excludedText: Signal<string> = computed((): string =>
    this.excluded() > 0 ? `Transfers excluded, ${this.excluded()} left out` : 'Transfers excluded',
  );

  protected readonly visibleChips: Signal<Chip[]> = computed((): Chip[] =>
    this.expanded() ? this.chips() : this.chips().slice(0, VISIBLE_CHIPS),
  );
  protected readonly hiddenCount: Signal<number> = computed((): number =>
    this.expanded() ? 0 : Math.max(0, this.chips().length - VISIBLE_CHIPS),
  );

  private coveredAccount(step: DrillStep | undefined, filters: ExploreFilters): boolean {
    return !!step && filters.accountIds.length === 1 && filters.accountIds[0] === step.value;
  }

  private accountName(id: number): string {
    return this.accounts().find((a: Account) => a.id === id)?.name ?? `Account ${id}`;
  }

  private categoryName(filters: ExploreFilters): string {
    return (
      filters.categoryName ??
      this.categories().find((c: Category) => c.id === filters.categoryId)?.name ??
      `Category ${filters.categoryId}`
    );
  }

  private merchantName(filters: ExploreFilters): string {
    return (
      filters.merchantName ??
      this.merchants().find((m: Merchant) => m.id === filters.merchantId)?.name ??
      `Merchant ${filters.merchantId}`
    );
  }

  private tagName(id: number): string {
    return this.tags().find((t: Tag) => t.id === id)?.name ?? `Tag ${id}`;
  }

  private amountText(filters: ExploreFilters): string {
    const { minAmount: min, maxAmount: max } = filters;
    if (min !== undefined && max !== undefined) return `${money(min)} to ${money(max)}`;
    return min !== undefined ? `at least ${money(min)}` : `up to ${money(max as number)}`;
  }

  protected remove(chip: Chip): void {
    if (chip.drillIndex !== null) {
      this.removeDrill.emit(chip.drillIndex);
    } else if (chip.without) {
      this.filtersChange.emit(chip.without);
    }
  }

  protected toggleAdd(): void {
    this.addOpen.update((open: boolean) => !open);
    this.addKind.set(null);
    this.minDraft.set('');
    this.maxDraft.set('');
  }

  protected onKind(kind: AddKind): void {
    this.addKind.set(kind);
  }

  private done(next: ExploreFilters): void {
    this.filtersChange.emit(next);
    this.addOpen.set(false);
    this.addKind.set(null);
  }

  protected addAccounts(ids: number[]): void {
    this.done({ ...this.filters(), accountIds: ids ?? [] });
  }

  protected addCategory(value: number | string): void {
    const next: ExploreFilters = { ...this.filters() };
    delete next.categoryId;
    delete next.categoryName;
    delete next.uncategorized;
    if (value === NONE) {
      next.uncategorized = true;
    } else {
      next.categoryId = value as number;
      next.categoryName = this.categories().find((c: Category) => c.id === value)?.name;
    }
    this.done(next);
  }

  protected addMerchant(value: number | string): void {
    const next: ExploreFilters = { ...this.filters() };
    delete next.merchantId;
    delete next.merchantName;
    delete next.noMerchant;
    if (value === NONE) {
      next.noMerchant = true;
    } else {
      next.merchantId = value as number;
      next.merchantName = this.merchants().find((m: Merchant) => m.id === value)?.name;
    }
    this.done(next);
  }

  protected addTag(value: number | string): void {
    const next: ExploreFilters = { ...this.filters() };
    delete next.tagId;
    delete next.noTag;
    if (value === NONE) {
      next.noTag = true;
    } else {
      next.tagId = value as number;
    }
    this.done(next);
  }

  protected applyAmount(): void {
    const min: number | undefined = this.minDraft() === '' ? undefined : Number(this.minDraft());
    const max: number | undefined = this.maxDraft() === '' ? undefined : Number(this.maxDraft());
    if (
      (min === undefined && max === undefined) ||
      (min !== undefined && max !== undefined && min > max)
    ) {
      return;
    }
    const next: ExploreFilters = { ...this.filters() };
    delete next.minAmount;
    delete next.maxAmount;
    if (min !== undefined) next.minAmount = min;
    if (max !== undefined) next.maxAmount = max;
    this.done(next);
  }
}
