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

import { MerchantApiService } from './services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { MerchantFormDialogComponent } from './components/merchant-form-dialog/merchant-form-dialog.component';
import { MergeMerchantsDialogComponent } from './components/merge-merchants-dialog/merge-merchants-dialog.component';
import { Merchant } from '@models/merchant.model';

const PAGE_SIZE = 20;

/**
 * Dedicated page for viewing, searching, and correcting the authenticated user's merchants
 * (PF-221) -- previously only reachable incidentally through the transaction and
 * recurring-transaction forms.
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
    ScreenToolbarComponent,
    MerchantFormDialogComponent,
    MergeMerchantsDialogComponent,
  ],
  templateUrl: './merchants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantsComponent implements OnInit {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The current page of merchants matching the active search term (PF-320: server-paginated
   *  and server-searched -- the full list is no longer loaded at once, since it grows unboundedly
   *  with a user's transaction history). */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  /** Total merchants matching the active search term, across all pages. */
  readonly totalRecords: WritableSignal<number> = signal(0);

  /** Zero-based index of the currently displayed page. */
  readonly page: WritableSignal<number> = signal(0);

  /** Global loading state for the page fetch. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Free-text search, matched server-side against both the display name and the raw bank
   *  description. Debounced (see constructor) before triggering a request. */
  readonly searchTerm: WritableSignal<string> = signal('');

  /** Visibility of the name-correction dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The merchant currently targeted for correction. */
  readonly selectedMerchant: WritableSignal<Merchant | null> = signal(null);

  /** Merchants checked in the table, for a merge (PF-222) -- capped at 2, see {@link onSelectionChange}. */
  readonly selectedForMerge: WritableSignal<Merchant[]> = signal([]);

  /** Visibility of the merge confirmation dialog. */
  readonly showMergeDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the user has no merchants at all (distinct from a search finding nothing) --
   *  only meaningful while no search is active, since totalRecords is otherwise search-scoped. */
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
   * Fetches the current page of the user's merchants, narrowed by the active search term.
   */
  loadData(): void {
    this.loading.set(true);
    this.merchantApi
      .getMerchants(this.searchTerm().trim() || null, { page: this.page(), size: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res): void => {
          this.merchants.set(res.content);
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
   * Opens the correction dialog for a merchant.
   * @param merchant the merchant to correct
   */
  openEditDialog(merchant: Merchant): void {
    this.selectedMerchant.set(merchant);
    this.showDialog.set(true);
  }

  /**
   * Refreshes the list after a successful correction.
   */
  onSave(): void {
    this.loadData();
  }

  /**
   * Handles the table's checkbox selection for a merge. Capped at 2: merging is only ever
   * between a pair, so a 3rd checkbox click replaces the oldest selection rather than growing
   * an open-ended list the merge dialog couldn't meaningfully use anyway.
   * @param selection the table's current full selection
   */
  onSelectionChange(selection: Merchant[]): void {
    this.selectedForMerge.set(selection.length <= 2 ? selection : selection.slice(-2));
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
}
