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
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';

import { MerchantApiService } from './services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { MerchantFormDialogComponent } from './components/merchant-form-dialog/merchant-form-dialog.component';
import { MerchantDescriptionLinksDialogComponent } from './components/merchant-description-links-dialog/merchant-description-links-dialog.component';
import { Merchant } from '@models/merchant.model';

const PAGE_SIZE = 20;

/**
 * Dedicated page for creating, editing, deleting, and managing the linked descriptions of the
 * authenticated user's merchants (PF-221, rebuilt for PF-846's deliberate-merchant model).
 *
 * A flat, paginated table -- one row per merchant. Under this model a merchant can no longer
 * fragment, so there's nothing left to group by clean name and no Needs Review queue to work
 * through; the grouped master/detail view and bulk-review tab this page used to have (PF-842) are
 * gone.
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
    TooltipModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    MerchantFormDialogComponent,
    MerchantDescriptionLinksDialogComponent,
  ],
  templateUrl: './merchants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantsComponent implements OnInit {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The current page of merchants matching the active search term -- server-paginated and
   *  server-searched (PF-320). */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  /** Total merchants matching the active search term, across all pages. */
  readonly totalRecords: WritableSignal<number> = signal(0);

  /** Zero-based index of the currently displayed page. */
  readonly page: WritableSignal<number> = signal(0);

  /** Loading state for the merchant-list fetch. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** `true` once a load has failed -- distinct from a merely-empty result. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Free-text search, matched server-side against name or city. Debounced (see constructor)
   *  before triggering a request. */
  readonly searchTerm: WritableSignal<string> = signal('');

  /** Visibility of the create/edit dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The merchant targeted for edit, or `null` when the dialog is in create mode. */
  readonly selectedMerchant: WritableSignal<Merchant | null> = signal(null);

  /** Visibility of the linked-descriptions management dialog. */
  readonly showLinksDialog: WritableSignal<boolean> = signal(false);

  /** The merchant whose linked descriptions are being managed. */
  readonly linksMerchant: WritableSignal<Merchant | null> = signal(null);

  /** Indicates if the user has no merchants at all -- distinct from a search finding nothing,
   *  since totalRecords is otherwise search-scoped. */
  readonly isEmpty: Signal<boolean> = computed(
    (): boolean =>
      this.totalRecords() === 0 &&
      !this.searchTerm().trim() &&
      !this.loading() &&
      !this.loadError(),
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
    this.loadError.set(false);
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
          this.loadError.set(true);
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
   * Opens the dialog in create mode.
   */
  openCreateDialog(): void {
    this.selectedMerchant.set(null);
    this.showDialog.set(true);
  }

  /**
   * Opens the dialog in edit mode for a merchant.
   * @param merchant the merchant to edit
   */
  openEditDialog(merchant: Merchant): void {
    this.selectedMerchant.set(merchant);
    this.showDialog.set(true);
  }

  /**
   * Refreshes the list after a successful create or edit.
   */
  onSave(): void {
    this.loadData();
  }

  /**
   * Opens the linked-descriptions management dialog for a merchant.
   * @param merchant the merchant whose links to manage
   */
  openLinksDialog(merchant: Merchant): void {
    this.linksMerchant.set(merchant);
    this.showLinksDialog.set(true);
  }

  /**
   * Deletes a merchant after confirmation. Dependent transactions are left with a blank merchant
   * rather than erroring; the merchant's description links are removed with it.
   * @param merchant the merchant to delete
   */
  deleteMerchant(merchant: Merchant): void {
    this.confirmationService.confirm({
      header: `Delete ${merchant.name}?`,
      message:
        'This will permanently delete the merchant and its linked descriptions. Transactions already assigned this merchant will be left blank, not deleted. This action cannot be undone.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.merchantApi
          .deleteMerchant(merchant.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Merchant deleted');
              this.loadData();
            },
            error: (err: any): void => {
              console.error('Error deleting merchant:', err);
              this.toast.error(err.error?.detail || 'Failed to delete merchant');
            },
          });
      },
    });
  }
}
