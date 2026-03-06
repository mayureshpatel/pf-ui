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
import {RecurringTransaction, RecurringSuggestion} from '@models/recurring.model';
import {Account} from '@models/account.model';
import {Merchant} from '@models/merchant.model';
import {RecurringApiService} from './services/recurring-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {AuthService} from '@core/auth/auth.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {RecurringFormDialogComponent} from './components/recurring-form-dialog/recurring-form-dialog.component';
import {RecurringSuggestionsDialogComponent} from './components/recurring-suggestions-dialog/recurring-suggestions-dialog.component';

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
  private readonly recurringApi = inject(RecurringApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  recurringTransactions: WritableSignal<RecurringTransaction[]> = signal([]);
  accounts: WritableSignal<Account[]> = signal([]);
  merchants: WritableSignal<Merchant[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);

  showFormDialog: WritableSignal<boolean> = signal(false);
  showSuggestionsDialog: WritableSignal<boolean> = signal(false);
  selectedRecurring: WritableSignal<RecurringTransaction | null> = signal(null);
  // Suggestion to pre-fill the form dialog
  pendingSuggestion: WritableSignal<RecurringSuggestion | null> = signal(null);

  isEmpty: Signal<boolean> = computed(() => this.recurringTransactions().length === 0 && !this.loading());

  readonly frequencyLabels: Record<string, string> = {
    WEEKLY: 'Weekly',
    BI_WEEKLY: 'Bi-Weekly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    YEARLY: 'Yearly'
  };

  ngOnInit(): void {
    this.loadRecurringTransactions();
    this.loadAccounts();
    this.loadMerchants();
  }

  loadRecurringTransactions(): void {
    this.loading.set(true);
    this.recurringApi.getAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (data: RecurringTransaction[]): void => this.recurringTransactions.set(data),
        error: (): void => this.toast.error('Failed to load recurring transactions')
      });
  }

  loadAccounts(): void {
    this.accountApi.getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Account[]): void => this.accounts.set(data),
        error: (): void => this.toast.error('Failed to load accounts')
      });
  }

  loadMerchants(): void {
    this.categoryApi.getMerchantsWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Merchant[]): void => this.merchants.set(data),
        error: (): void => {}
      });
  }

  openCreateDialog(): void {
    this.selectedRecurring.set(null);
    this.showFormDialog.set(true);
  }

  openEditDialog(rec: RecurringTransaction): void {
    this.selectedRecurring.set(rec);
    this.showFormDialog.set(true);
  }

  onSaved(): void {
    this.loadRecurringTransactions();
  }

  onSuggestionAccepted(suggestion: RecurringSuggestion): void {
    this.pendingSuggestion.set(suggestion);
    this.selectedRecurring.set(null);
    this.showFormDialog.set(true);
  }

  deleteRecurring(rec: RecurringTransaction): void {
    this.confirmationService.confirm({
      header: 'Delete Recurring Transaction?',
      message: 'This will permanently delete this recurring transaction entry.',
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
              this.loadRecurringTransactions();
            },
            error: (error: any): void => {
              console.error('Failed to delete recurring transaction:', error);
              this.toast.error(error.error?.detail || 'Failed to delete recurring transaction');
            }
          });
      }
    });
  }
}
