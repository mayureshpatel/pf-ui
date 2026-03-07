import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {finalize} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {TagModule} from 'primeng/tag';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';

import {RecurringSuggestion, RecurringTransaction} from '@models/recurring.model';
import {Account} from '@models/account.model';
import {Merchant} from '@models/merchant.model';
import {RecurringApiService} from './services/recurring-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {RecurringFormDialogComponent} from './components/recurring-form-dialog/recurring-form-dialog.component';
import {
  RecurringSuggestionsDialogComponent
} from './components/recurring-suggestions-dialog/recurring-suggestions-dialog.component';

/**
 * Component for managing recurring financial obligations and income.
 *
 * Provides a specialized interface for tracking subscriptions, rent, and other
 * repeating transactions. Includes an intelligent "Suggestions" engine to help
 * users identify and automate recurring patterns.
 */
@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    TagModule,
    TooltipModule,
    ScreenToolbarComponent,
    RecurringFormDialogComponent,
    RecurringSuggestionsDialogComponent
  ],
  templateUrl: './recurring.component.html'
})
export class RecurringComponent implements OnInit {
  private readonly recurringApi: RecurringApiService = inject(RecurringApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The list of active and inactive recurring transactions. */
  readonly recurringTransactions: WritableSignal<RecurringTransaction[]> = signal([]);

  /** Available accounts for transaction association. */
  readonly accounts: WritableSignal<Account[]> = signal([]);

  /** Known merchants for easier categorization. */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  /** Global loading state for recurring data. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Visibility of the creation/edit dialog. */
  readonly showFormDialog: WritableSignal<boolean> = signal(false);

  /** Visibility of the pattern suggestion dialog. */
  readonly showSuggestionsDialog: WritableSignal<boolean> = signal(false);

  /** The recurring entry currently selected for editing. */
  readonly selectedRecurring: WritableSignal<RecurringTransaction | null> = signal(null);

  /** A suggestion that is being transformed into a permanent recurring entry. */
  readonly pendingSuggestion: WritableSignal<RecurringSuggestion | null> = signal(null);

  /** Indicates if there are no recurring transactions to display. */
  readonly isEmpty: Signal<boolean> = computed(() => this.recurringTransactions().length === 0 && !this.loading());

  readonly frequencyLabels: Record<string, string> = {
    WEEKLY: 'Weekly',
    BI_WEEKLY: 'Bi-Weekly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    YEARLY: 'Yearly'
  };

  /**
   * Initializes component data on load.
   */
  ngOnInit(): void {
    this.refreshAll();
    this.loadAccounts();
    this.loadMerchants();
  }

  /**
   * Refreshes the recurring transactions list from the API.
   */
  refreshAll(): void {
    this.loading.set(true);
    this.recurringApi.getAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (data: RecurringTransaction[]): void => this.recurringTransactions.set(data),
        error: (err: any): void => {
          console.error('Failed to load recurring data:', err);
          this.toast.error('Failed to load recurring transactions');
        }
      });
  }

  /**
   * Loads the list of available bank/financial accounts.
   */
  private loadAccounts(): void {
    this.accountApi.getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Account[]): void => this.accounts.set(data),
        error: (err: any): void => {
          console.error('Failed to load accounts for selection:', err);
          this.toast.error('Failed to load accounts');
        }
      });
  }

  /**
   * Loads the list of known merchants for the selection dropdown.
   */
  private loadMerchants(): void {
    this.categoryApi.getMerchantsWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Merchant[]): void => this.merchants.set(data),
        error: (err: any): void => console.error('Failed to load merchants for selection:', err)
      });
  }

  /**
   * Opens the creation dialog in a clean state.
   */
  openCreateDialog(): void {
    this.selectedRecurring.set(null);
    this.pendingSuggestion.set(null);
    this.showFormDialog.set(true);
  }

  /**
   * Opens the edit dialog for a specific entry.
   * @param rec - The recurring transaction to edit.
   */
  openEditDialog(rec: RecurringTransaction): void {
    this.selectedRecurring.set(rec);
    this.pendingSuggestion.set(null);
    this.showFormDialog.set(true);
  }

  /**
   * Callback for when a transaction is successfully saved.
   */
  onSaved(): void {
    this.refreshAll();
  }

  /**
   * Transforms a pattern suggestion into a form entry.
   * @param suggestion - The detected recurring pattern.
   */
  onSuggestionAccepted(suggestion: RecurringSuggestion): void {
    this.pendingSuggestion.set(suggestion);
    this.selectedRecurring.set(null);
    this.showFormDialog.set(true);
  }

  /**
   * Permanently deletes a recurring transaction.
   * @param rec - The recurring transaction to delete.
   */
  deleteRecurring(rec: RecurringTransaction): void {
    this.confirmationService.confirm({
      header: 'Delete Recurring Transaction?',
      message: `This will stop tracking the recurring payment for '${rec.merchant.cleanName}'. Are you sure?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.recurringApi.delete(rec.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Recurring transaction deleted');
              this.refreshAll();
            },
            error: (error: any): void => {
              console.error('Failed to delete recurring entry:', error);
              this.toast.error(error.error?.detail || 'Failed to delete entry');
            }
          });
      }
    });
  }
}
