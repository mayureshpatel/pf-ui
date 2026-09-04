import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {InputTextModule} from 'primeng/inputtext';
import {IconFieldModule} from 'primeng/iconfield';
import {InputIconModule} from 'primeng/inputicon';

import {MerchantApiService} from './services/merchant-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {MerchantFormDialogComponent} from './components/merchant-form-dialog/merchant-form-dialog.component';
import {MergeMerchantsDialogComponent} from './components/merge-merchants-dialog/merge-merchants-dialog.component';
import {Merchant} from '@models/merchant.model';

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
    MergeMerchantsDialogComponent
  ],
  templateUrl: './merchants.component.html'
})
export class MerchantsComponent implements OnInit {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The full, unfiltered list of the user's merchants. */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  /** Global loading state for the initial fetch. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Free-text search, matched against both the display name and the raw bank description. */
  readonly searchTerm: WritableSignal<string> = signal('');

  /** Visibility of the name-correction dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The merchant currently targeted for correction. */
  readonly selectedMerchant: WritableSignal<Merchant | null> = signal(null);

  /** Merchants checked in the table, for a merge (PF-222) -- capped at 2, see {@link onSelectionChange}. */
  readonly selectedForMerge: WritableSignal<Merchant[]> = signal([]);

  /** Visibility of the merge confirmation dialog. */
  readonly showMergeDialog: WritableSignal<boolean> = signal(false);

  /** Merchants matching the current search term, sorted by display name. */
  readonly filteredMerchants: Signal<Merchant[]> = computed((): Merchant[] => {
    const term: string = this.searchTerm().trim().toLowerCase();
    const all: Merchant[] = this.merchants();
    const matches: Merchant[] = term
      ? all.filter((m: Merchant): boolean =>
          m.cleanName.toLowerCase().includes(term) || m.originalName.toLowerCase().includes(term))
      : all;
    return [...matches].sort((a: Merchant, b: Merchant): number => a.cleanName.localeCompare(b.cleanName));
  });

  /** Indicates if the user has no merchants at all (distinct from a search finding nothing). */
  readonly isEmpty: Signal<boolean> = computed((): boolean =>
    this.merchants().length === 0 && !this.loading()
  );

  /** Indicates if a search is active but matched nothing. */
  readonly noSearchResults: Signal<boolean> = computed((): boolean =>
    !this.isEmpty() && this.filteredMerchants().length === 0
  );

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Fetches the user's merchants.
   */
  loadData(): void {
    this.loading.set(true);
    this.merchantApi.getMerchants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Merchant[]): void => {
          this.merchants.set(data);
          this.loading.set(false);
        },
        error: (err: any): void => {
          console.error('Failed to load merchants:', err);
          this.toast.error('Failed to load merchants');
          this.loading.set(false);
        }
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
