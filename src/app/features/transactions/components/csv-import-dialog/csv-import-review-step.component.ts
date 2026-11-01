import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Signal,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';
import { SelectModule } from 'primeng/select';

import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { TransactionType } from '@models/transaction.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { FormatTransactionTypeAmountPipe } from '@shared/pipes/format-transaction-type-amount.pipe';
import { BatchFile, CsvImportBatchStore, ReviewRow } from './csv-import-batch.store';

interface SelectOption {
  label: string;
  value: number;
}

interface FileCounts {
  rows: number;
  willImport: number;
  skipped: number;
}

interface HeaderItem {
  kind: 'header';
  key: string;
  file: BatchFile;
  accountName: string;
  counts: FileCounts;
}

interface RowItem {
  kind: 'row';
  key: string;
  file: BatchFile;
  /** Index into `file.rows`, which is what {@link CsvImportBatchStore.editRow} takes. */
  rowIndex: number;
  row: ReviewRow;
  editable: boolean;
}

interface MessageItem {
  kind: 'message';
  key: string;
  text: string;
}

type ReviewItem = HeaderItem | RowItem | MessageItem;

interface RowStatus {
  label: string;
  icon: string;
  tone: string;
}

/**
 * Fixed heights (rem) of each windowed item, matching the `h-*` classes in the template (`h-14` is
 * 3.5rem, `h-16` 4rem, `h-20` 5rem, `h-60` 15rem): the window is computed from these, so the two
 * must change together. They are rem, not px, so a raised browser font size scales both alike.
 */
const ITEM_HEIGHTS_REM: Record<'desktop' | 'mobile', Record<ReviewItem['kind'], number>> = {
  desktop: { header: 4, row: 3.5, message: 3.5 },
  mobile: { header: 5, row: 15, message: 3.5 },
};
/** Height of the scroll viewport (`h-120`, 30rem) before it has been measured. */
const DEFAULT_VIEWPORT_REM = 30;
/** Items rendered beyond each edge of the viewport, so Tab always has a next row to land on. */
const OVERSCAN = 4;
/** One request, at Spring's default maximum page size; see the PF-898 task 9 report. */
const MERCHANT_PAGE_SIZE = 2000;
const DESKTOP_QUERY = '(min-width: 48rem)';

const EDITED_UNCATEGORIZED: RowStatus = {
  label: 'Edited - Uncategorized',
  icon: 'pi-exclamation-triangle',
  tone: 'text-amber-700 dark:text-amber-400',
};
const STATUS: Record<ReviewRow['origin'], RowStatus> = {
  rule: {
    label: 'Rule applied',
    icon: 'pi-bolt',
    tone: 'text-primary-700 dark:text-primary-400',
  },
  guess: {
    label: 'Suggested',
    icon: 'pi-info-circle',
    tone: 'text-blue-700 dark:text-blue-300',
  },
  edited: {
    label: 'Edited',
    icon: 'pi-pencil',
    tone: 'text-surface-700 dark:text-surface-200',
  },
  none: {
    label: 'Uncategorized',
    icon: 'pi-exclamation-triangle',
    tone: 'text-amber-700 dark:text-amber-400',
  },
};
const SKIPPED: Record<'duplicate' | 'file-already-imported', RowStatus> = {
  duplicate: {
    label: 'Will be skipped: duplicate',
    icon: 'pi-ban',
    tone: 'text-muted-color',
  },
  'file-already-imported': {
    label: 'Will be skipped: file already imported',
    icon: 'pi-ban',
    tone: 'text-muted-color',
  },
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A row still to be imported that has no category, or only a guessed one. */
function needsALook(row: ReviewRow): boolean {
  return row.skip === null && (row.category === null || row.origin === 'guess');
}

function rootFontSize(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function categoryLabel(c: Category): string {
  return c.parent ? `${c.parent.name} / ${c.name}` : c.name;
}

/**
 * Step 2 of the CSV import dialog (PF-898): every previewed transaction, grouped by file, with an
 * inline merchant and category editor per row. An edit changes that one row only, through
 * {@link CsvImportBatchStore.editRow}.
 *
 * Rows are windowed: group headers and rows are flattened into one list of fixed-height items and
 * only those near the viewport are rendered, so a batch of thousands of rows stays responsive.
 * PrimeNG's `p-table` virtual scroll was not used because it needs one fixed row height, while
 * this list mixes file headers with rows and stacks rows as taller cards on a phone.
 */
@Component({
  selector: 'app-csv-import-review-step',
  standalone: true,
  imports: [DatePipe, FormsModule, SelectModule, FormatTransactionTypeAmountPipe],
  providers: [FormatCurrencyPipe],
  templateUrl: './csv-import-review-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvImportReviewStepComponent {
  private readonly store: CsvImportBatchStore = inject(CsvImportBatchStore);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);

  private readonly categories: Signal<Category[]> = toSignal(
    this.categoryApi.getCategories().pipe(catchError(() => of([] as Category[]))),
    { initialValue: [] },
  );
  private readonly merchants: Signal<Merchant[]> = toSignal(
    this.merchantApi.getMerchants(null, { page: 0, size: MERCHANT_PAGE_SIZE, sort: 'name' }).pipe(
      map((page) => page.content),
      catchError(() => of([] as Merchant[])),
    ),
    { initialValue: [] },
  );

  readonly needsLookOnly = signal(false);
  /**
   * Rows edited while "Needs a look" is on: they stay listed (so the row, and keyboard focus in
   * it, does not vanish mid-edit) until the filter is toggled again.
   */
  private readonly stickyKeys = signal<ReadonlySet<string>>(new Set());

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly scrollTop = signal(0);
  /** Pixels per rem, re-read whenever the scroller resizes (a root font-size change resizes it). */
  private readonly remPx = signal(rootFontSize());
  private readonly viewportHeight = signal(DEFAULT_VIEWPORT_REM * rootFontSize());
  private readonly desktop = signal(true);

  /** Files whose preview failed; listed above the table and left out of it. */
  readonly failedFiles = computed((): BatchFile[] =>
    this.store
      .items()
      .filter((f: BatchFile): boolean => f.status === 'failed' && f.failedAt === 'preview'),
  );

  private readonly reviewFiles = computed((): BatchFile[] =>
    this.store
      .items()
      .filter((f: BatchFile): boolean => !(f.status === 'failed' && f.failedAt === 'preview')),
  );

  readonly totals = computed(() => {
    let rows = 0;
    let skipped = 0;
    let needsLook = 0;
    for (const f of this.reviewFiles()) {
      rows += f.rows.length;
      for (const r of f.rows) {
        if (r.skip !== null) skipped++;
        if (needsALook(r)) needsLook++;
      }
    }
    return {
      files: this.reviewFiles().length,
      rows,
      skipped,
      willImport: rows - skipped,
      needsLook,
    };
  });

  readonly summaryText = computed((): string => {
    const t = this.totals();
    return [
      `${plural(t.rows, 'transaction', 'transactions')} in ${plural(t.files, 'file', 'files')}`,
      `${t.willImport} will import`,
      `${t.skipped} will be skipped`,
    ].join(' · ');
  });

  private readonly merchantById = computed((): Map<number, Merchant> => {
    const byId = new Map<number, Merchant>();
    this.merchants().forEach((m: Merchant) => byId.set(m.id, m));
    // a suggested merchant beyond the loaded page must still show on its row
    for (const f of this.reviewFiles()) {
      for (const r of f.rows)
        if (r.merchant && !byId.has(r.merchant.id)) byId.set(r.merchant.id, r.merchant);
    }
    return byId;
  });

  private readonly categoryById = computed((): Map<number, Category> => {
    const byId = new Map<number, Category>();
    this.categories().forEach((c: Category) => byId.set(c.id, c));
    for (const f of this.reviewFiles()) {
      for (const r of f.rows)
        if (r.category && !byId.has(r.category.id)) byId.set(r.category.id, r.category);
    }
    return byId;
  });

  readonly merchantOptions = computed((): SelectOption[] =>
    [...this.merchantById().values()]
      .map((m: Merchant): SelectOption => ({ label: m.name, value: m.id }))
      .sort((a: SelectOption, b: SelectOption): number => a.label.localeCompare(b.label)),
  );

  readonly categoryOptions = computed((): SelectOption[] =>
    [...this.categoryById().values()]
      .map((c: Category): SelectOption => ({ label: categoryLabel(c), value: c.id }))
      .sort((a: SelectOption, b: SelectOption): number => a.label.localeCompare(b.label)),
  );

  /** Headers, rows and per-file messages, flattened in display order. */
  readonly items = computed((): ReviewItem[] => {
    const onlyNeedsLook: boolean = this.needsLookOnly();
    const sticky: ReadonlySet<string> = this.stickyKeys();
    const committing: boolean = this.store.committing();
    const accounts: Account[] = this.store.accountList();
    const out: ReviewItem[] = [];
    for (const file of this.reviewFiles()) {
      const final: boolean = file.status === 'committed' || file.status === 'skipped';
      const rowItems: RowItem[] = [];
      let skipped = 0;
      file.rows.forEach((row: ReviewRow, rowIndex: number): void => {
        if (row.skip !== null) skipped++;
        const key = `${file.id}:${rowIndex}`;
        if (onlyNeedsLook && !needsALook(row) && !sticky.has(key)) return;
        rowItems.push({
          kind: 'row',
          key,
          file,
          rowIndex,
          row,
          editable: !committing && !final && row.skip === null,
        });
      });
      if (onlyNeedsLook && rowItems.length === 0) continue;
      out.push({
        kind: 'header',
        key: `${file.id}:header`,
        file,
        accountName: accounts.find((a: Account): boolean => a.id === file.accountId)?.name ?? '',
        counts: { rows: file.rows.length, willImport: file.rows.length - skipped, skipped },
      });
      if (file.status === 'pending' || file.status === 'previewing') {
        out.push({ kind: 'message', key: `${file.id}:message`, text: 'Not previewed yet' });
      } else if (file.rows.length === 0) {
        out.push({
          kind: 'message',
          key: `${file.id}:message`,
          text: 'No transactions in this file',
        });
      }
      out.push(...rowItems);
    }
    return out;
  });

  /** `offsets[i]` is the top of item `i`; the last entry is the total height. */
  private readonly offsets = computed((): number[] => {
    const rem: Record<ReviewItem['kind'], number> =
      ITEM_HEIGHTS_REM[this.desktop() ? 'desktop' : 'mobile'];
    const px: number = this.remPx();
    const offsets: number[] = [0];
    for (const item of this.items()) {
      offsets.push(offsets[offsets.length - 1] + rem[item.kind] * px);
    }
    return offsets;
  });

  readonly totalHeight = computed((): number => this.offsets()[this.offsets().length - 1]);

  private readonly range = computed((): { start: number; end: number } => {
    const offsets: number[] = this.offsets();
    const count: number = offsets.length - 1;
    const height: number = this.viewportHeight();
    const top: number = Math.max(0, Math.min(this.scrollTop(), this.totalHeight() - height));
    const first: number = this.indexAt(offsets, top);
    const last: number = this.indexAt(offsets, top + height);
    return { start: Math.max(0, first - OVERSCAN), end: Math.min(count, last + 1 + OVERSCAN) };
  });

  readonly visibleItems = computed((): ReviewItem[] =>
    this.items().slice(this.range().start, this.range().end),
  );
  readonly firstVisible = computed((): number => this.range().start);
  readonly windowOffset = computed(
    (): string => `translateY(${this.offsets()[this.range().start]}px)`,
  );

  constructor() {
    const query: MediaQueryList = window.matchMedia(DESKTOP_QUERY);
    this.desktop.set(query.matches);
    const onChange = (e: MediaQueryListEvent): void => this.desktop.set(e.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));

    effect((onCleanup): void => {
      const el: HTMLElement | undefined = this.scroller()?.nativeElement;
      if (!el) return;
      const observer = new ResizeObserver((): void => {
        const px: number = rootFontSize();
        this.remPx.set(px);
        this.viewportHeight.set(el.clientHeight || DEFAULT_VIEWPORT_REM * px);
      });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.scrollTop.set(el.scrollTop);
    if (el.clientHeight) this.viewportHeight.set(el.clientHeight);
  }

  toggleNeedsLook(): void {
    this.needsLookOnly.update((on: boolean): boolean => !on);
    this.stickyKeys.set(new Set());
    const el: HTMLElement | undefined = this.scroller()?.nativeElement;
    if (el) el.scrollTop = 0;
    this.scrollTop.set(0);
  }

  setMerchant(item: RowItem, id: number | null): void {
    const merchant: Merchant | null = id === null ? null : (this.merchantById().get(id) ?? null);
    this.keepListed(item);
    this.store.editRow(item.file.id, item.rowIndex, { merchant });
  }

  setCategory(item: RowItem, id: number | null): void {
    const category: Category | null = id === null ? null : (this.categoryById().get(id) ?? null);
    this.keepListed(item);
    this.store.editRow(item.file.id, item.rowIndex, { category });
  }

  status(row: ReviewRow): RowStatus {
    if (row.skip) return SKIPPED[row.skip];
    if (row.category === null) return row.origin === 'edited' ? EDITED_UNCATEGORIZED : STATUS.none;
    return STATUS[row.origin];
  }

  private keepListed(item: RowItem): void {
    if (!this.needsLookOnly()) return;
    this.stickyKeys.update(
      (keys: ReadonlySet<string>): ReadonlySet<string> => new Set([...keys, item.key]),
    );
  }

  amountTone(type: TransactionType): string {
    switch (type) {
      case TransactionType.INCOME:
      case TransactionType.TRANSFER_IN:
        return 'text-emerald-700 dark:text-emerald-400';
      case TransactionType.EXPENSE:
      case TransactionType.TRANSFER_OUT:
        return 'text-rose-700 dark:text-rose-400';
      default:
        return 'text-surface-500 dark:text-surface-400';
    }
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  /** Unique per row across the batch, for `ariaLabelledBy` (PF-805). */
  labelId(item: RowItem, field: 'merchant' | 'category'): string {
    return `csv-review-${field}-label-${item.file.id}-${item.rowIndex}`;
  }

  /** The item whose span contains `y` (binary search over `offsets`). */
  private indexAt(offsets: number[], y: number): number {
    let lo = 0;
    let hi = offsets.length - 2;
    while (lo < hi) {
      const mid: number = (lo + hi + 1) >> 1;
      if (offsets[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(0, lo);
  }
}
