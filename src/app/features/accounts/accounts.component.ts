import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';
import {Account, AccountCreateRequest, AccountType, AccountUpdateRequest} from '@models/account.model';
import {AccountApiService} from './services/account-api.service';
import {AccountSummaryCardsComponent} from './components/account-summary-cards/account-summary-cards.component';
import {AccountFormDrawerComponent} from './components/account-form-drawer/account-form-drawer.component';
import {ReconcileDrawerComponent} from './components/reconcile-dialog/reconcile-dialog.component';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {finalize, forkJoin} from 'rxjs';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    TooltipModule,
    ScreenToolbarComponent,
    AccountSummaryCardsComponent,
    AccountFormDrawerComponent,
    ReconcileDrawerComponent,
    FormatCurrencyPipe
  ],
  templateUrl: './accounts.component.html'
})
export class AccountsComponent implements OnInit {
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  accounts: WritableSignal<Account[]> = signal([]);
  accountTypes: WritableSignal<AccountType[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showReconcileDrawer: WritableSignal<boolean> = signal(false);
  selectedAccount: WritableSignal<Account | null> = signal(null);

  isEmpty: Signal<boolean> = computed((): boolean => this.accounts().length === 0 && !this.loading());

  /**
   * Lifecycle hook that initializes the component.
   */
  ngOnInit(): void {
    this.loadAccounts();
  }

  /**
   * Loads accounts from the API and updates the accounts signal.
   */
  loadAccounts(): void {
    this.loading.set(true);

    forkJoin({
      accounts: this.accountApi.getAccounts(),
      accountTypes: this.accountApi.getAccountTypes()
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      ).subscribe({
      next: ({accounts, accountTypes}): void => {
        this.accounts.set(accounts);
        this.accountTypes.set(accountTypes);
      },
      error: (error: any): void => {
        console.error('Error loading accounts:', error);
        this.toast.error('Failed to load accounts');
      }
    });
  }

  /**
   * Opens the account creation dialog.
   */
  openCreateDialog(): void {
    this.selectedAccount.set(null);
    this.showDialog.set(true);
  }

  /**
   * Opens the account edit dialog for the selected account.
   * @param account The account to edit.
   */
  openEditDialog(account: Account): void {
    this.selectedAccount.set(account);
    this.showDialog.set(true);
  }

  /**
   * Opens the account reconcile drawer for the selected account.
   * @param account The account to reconcile.
   */
  openReconcileDrawer(account: Account): void {
    this.selectedAccount.set(account);
    this.showReconcileDrawer.set(true);
  }

  onSave(formData: AccountCreateRequest | AccountUpdateRequest): void {
    const account: Account | null = this.selectedAccount();

    if (account) {
      this.editAccount(formData as AccountUpdateRequest);
    } else {
      this.createAccount(formData as AccountCreateRequest);
    }
  }

  /**
   * Handles the creation of a new account.
   * @param data The account data to create.
   */
  private createAccount(data: AccountCreateRequest): void {
    this.accountApi.create(data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          this.toast.success('Account created successfully');
          this.showDialog.set(false);
          this.loadAccounts();
        },
        error: (error: any): void => {
          console.error('Error creating account:', error);
          this.toast.error(error.error?.detail || 'Failed to create account');
        }
      });
  }

  /**
   * Handles the editing of an existing account.
   * @param data The updated account data.
   */
  private editAccount(data: AccountUpdateRequest): void {
    this.accountApi.update(data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          this.toast.success('Account updated successfully');
          this.showDialog.set(false);
          this.loadAccounts();
        },
        error: (error: any): void => {
          console.error('Error updating account:', error);
          this.toast.error(error.error?.detail || 'Failed to update account');
        }
      });
  }

  /**
   * Deletes an account.
   * @param account the account to delete
   */
  deleteAccount(account: Account): void {
    this.confirmationService.confirm({
      header: `Delete ${account.name}?`,
      message: 'This will permanently delete the account. This action cannot be undone.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.accountApi.delete(account.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.accounts.set(this.accounts().filter((a: Account): boolean => a.id !== account.id));
              this.toast.success('Account deleted successfully');
            },
            error: (error: any): void => {
              console.error('Error deleting account:', error);
              const message = error.error?.detail || 'Failed to delete account';
              this.toast.error(message);
            }
          });
      }
    });
  }
}
