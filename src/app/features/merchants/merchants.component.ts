import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CheckboxModule } from 'primeng/checkbox';
import { TabsModule } from 'primeng/tabs';

import { MerchantApiService } from './services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { MerchantFormDialogComponent } from './components/merchant-form-dialog/merchant-form-dialog.component';
import { MergeMerchantsDialogComponent } from './components/merge-merchants-dialog/merge-merchants-dialog.component';
import { MerchantNeedsReviewComponent } from './components/merchant-needs-review/merchant-needs-review.component';
import { Merchant } from '@models/merchant.model';

const PAGE_SIZE = 20;

/**
 * A distinct clean-name group's outer row (PF-842). {@code members} starts {@code null} (not yet
 * loaded) and is only fetched the first time the group is expanded -- the outer list itself is
 * paginated and could span far more groups than are ever actually opened in one visit.
 */
interface CleanNameGroup {
  cleanName: string;
  members: Merchant[] | null;
}

/**
 * Dedicated page for viewing, searching, and correcting the authenticated user's merchants
 * (PF-221) -- previously only reachable incidentally through the transaction and
 * recurring-transaction forms.
 *
 * PF-842: restructured from a flat one-row-per-merchant table into a grouped master/detail view
 * keyed by clean name (many original-name rows can now deliberately share one clean name, per
 * PF-840's redesign), plus a "Needs Review" tab for bulk-confirming suggested groupings instead
 * of correcting hundreds of rows by hand.
 */
@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    CardModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    CheckboxModule,
    TabsModule,
    ScreenToolbarComponent,
    MerchantFormDialogComponent,
    MergeMerchantsDialogComponent,
    MerchantNeedsReviewComponent,
  ],
  templateUrl: './merchants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantsComponent implements OnInit {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** Which tab is active: 0 = grouped Merchants view, 1 = Needs Review. */
  readonly activeTab: WritableSignal<number> = signal(0);

  /** The current page of distinct clean-name groups matching the active search term -- server-
   *  paginated and server-searched, same rationale as the pre-PF-842 flat list (PF-320). */
  readonly groups: WritableSignal<CleanNameGroup[]> = signal([]);

  /** Total distinct clean names matching the active search term, across all pages. */
  readonly totalRecords: WritableSignal<number> = signal(0);

  /** Zero-based index of the currently displayed page. */
  readonly page: WritableSignal<number> = signal(0);

  /** Global loading state for the group-list fetch. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Free-text search, matched server-side against clean name. Debounced (see constructor)
   *  before triggering a request. */
  readonly searchTerm: WritableSignal<string> = signal('');

  /** Controls which outer group rows are expanded, keyed by clean name. */
  readonly expandedRowKeys: WritableSignal<Record<string, boolean>> = signal({});

  /** Visibility of the name-correction dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The merchant currently targeted for correction. */
  readonly selectedMerchant: WritableSignal<Merchant | null> = signal(null);

  /** Merchants checked (potentially across several independently-expanded groups) for a merge --
   *  capped at 2, see {@link toggleForMerge}. */
  readonly selectedForMerge: WritableSignal<Merchant[]> = signal([]);

  /** Visibility of the merge confirmation dialog. */
  readonly showMergeDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the user has no reviewed merchants (distinct clean names) at all -- distinct
   *  from a search finding nothing, since totalRecords is otherwise search-scoped. */
  readonly isEmpty: Signal<boolean> = computed(
    (): boolean => this.totalRecords() === 0 && !this.searchTerm().trim() && !this.loading(),
  );

  /** Indicates if a search is active but matched nothing. */
  readonly noSearchResults: Signal<boolean> = computed(
    (): boolean => this.totalRecords() === 0 && !!this.searchTerm().trim() && !this.loading(),
  );

  /** Drives the debounced search request (PF-320). */
  private readonly searchInput$: Subject<string> = new Subject<string>();

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => {
        this.page.set(0);
        this.loadData();
      });
  }

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Handles the search box's input: updates the displayed value immediately (so typing itself
   * never feels laggy), but debounces the actual backend request.
   * @param term the raw text currently in the search box.
   */
  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.searchInput$.next(term);
  }

  /**
   * Fetches the current page of the user's distinct clean names, narrowed by the active search
   * term. Collapses every group back closed -- a stale expanded-by-clean-name key from a previous
   * page/search wouldn't correspond to anything on the new page anyway.
   */
  loadData(): void {
    this.loading.set(true);
    this.expandedRowKeys.set({});
    this.merchantApi
      .getDistinctCleanNames(this.searchTerm().trim() || null, {
        page: this.page(),
        size: PAGE_SIZE,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res): void => {
          this.groups.set(
            res.content.map((cleanName): CleanNameGroup => ({ cleanName, members: null })),
          );
          this.totalRecords.set(res.page.totalElements);
          this.loading.set(false);
        },
        error: (err: any): void => {
          console.error('Failed to load merchants:', err);
          this.toast.error('Failed to load merchants');
          this.loading.set(false);
        },
      });
  }

  /**
   * Handles the table's lazy-load event (page navigation).
   * @param event the PrimeNG lazy-load event carrying the new page's starting row offset.
   */
  onPageChange(event: { first?: number }): void {
    this.page.set(Math.floor((event.first ?? 0) / PAGE_SIZE));
    this.loadData();
  }

  /**
   * Lazily loads a group's member merchants the first time it's expanded (PF-842) -- re-expanding
   * an already-loaded group is a no-op, not a refetch.
   * @param event the PrimeNG row-expand event; `data` is the expanded group.
   */
  onGroupExpand(event: { data: CleanNameGroup }): void {
    const group = event.data;
    if (group.members !== null) return;

    this.merchantApi
      .getMerchantsByCleanName(group.cleanName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members): void => {
          this.groups.update((groups): CleanNameGroup[] =>
            groups.map((g): CleanNameGroup =>
              g.cleanName === group.cleanName ? { ...g, members } : g,
            ),
          );
        },
        error: (err: any): void => {
          console.error('Failed to load merchant group:', err);
          this.toast.error('Failed to load merchant group');
        },
      });
  }

  /**
   * Opens the correction dialog for a merchant.
   * @param merchant the merchant to correct
   */
  openEditDialog(merchant: Merchant): void {
    this.selectedMerchant.set(merchant);
    this.showDialog.set(true);
  }

  /**
   * Refreshes the list after a successful correction -- reloads everything rather than patching
   * one group in place, since correcting a row's clean name can move it into a different group
   * (possibly a brand-new one, or leave its old group empty) as well as its own.
   */
  onSave(): void {
    this.loadData();
  }

  /**
   * Whether a specific merchant row is currently selected for a merge.
   * @param merchant the row to check
   */
  isSelectedForMerge(merchant: Merchant): boolean {
    return this.selectedForMerge().some((m): boolean => m.id === merchant.id);
  }

  /**
   * Toggles a member row's merge selection (PF-842). Deliberately manual rather than PrimeNG's
   * built-in table selection: selection must span multiple independently-expanded groups, each
   * its own nested `p-table` instance, which built-in single-table selection binding can't do.
   * Capped at 2: merging is only ever between a pair, so a 3rd checkbox click replaces the oldest
   * selection rather than growing an open-ended list the merge dialog couldn't use anyway.
   * @param merchant the row being checked or unchecked
   */
  toggleForMerge(merchant: Merchant): void {
    this.selectedForMerge.update((selected): Merchant[] => {
      if (selected.some((m): boolean => m.id === merchant.id)) {
        return selected.filter((m): boolean => m.id !== merchant.id);
      }
      const next: Merchant[] = [...selected, merchant];
      return next.length <= 2 ? next : next.slice(-2);
    });
  }

  /**
   * Opens the merge confirmation dialog for the 2 currently-selected merchants.
   */
  openMergeDialog(): void {
    this.showMergeDialog.set(true);
  }

  /**
   * Refreshes the list and clears the selection after a successful merge.
   */
  onMerged(): void {
    this.selectedForMerge.set([]);
    this.loadData();
  }

  /**
   * Refreshes the grouped view after a cluster is confirmed in the Needs Review tab (PF-842) --
   * the newly-labeled merchants should now appear correctly grouped here.
   */
  onClusterConfirmed(): void {
    this.loadData();
  }
}
