import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';
import {Account, AccountType} from '@models/account.model';
import {AccountApiService} from './services/account-api.service';
import {AccountSummaryCardsComponent} from './components/account-summary-cards/account-summary-cards.component';
import {AccountFormDrawerComponent} from './components/account-form-drawer/account-form-drawer.component';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {finalize} from 'rxjs';
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
    FormatCurrencyPipe
  ],
  templateUrl: './accounts.component.html'
})
export class AccountsComponent implements OnInit {
  // injected services
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly accountTypeApi: AccountApiService = inject(AccountApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // signals
  accounts: WritableSignal<Account[]> = signal([]);
  accountTypes: WritableSignal<AccountType[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  selectedAccount: WritableSignal<Account | null> = signal(null);

  // computed signals
  isEmpty: Signal<boolean> = computed((): boolean => this.accounts().length === 0 && !this.loading());

  ngOnInit(): void {
    this.loadAccounts();
  }

  /**
   * Loads accounts from the API and updates the accounts signal.
   */
  loadAccounts(): void {
    this.loading.set(true);

    this.accountTypeApi.getAccountTypes()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (accountTypes: AccountType[]): void => {
          this.accountTypes.set(accountTypes);
        },
        error: (error: any): void => {
          console.error("Error loading account types: ", error);
          this.toast.error("Failed to load account types");
        }
      });


    this.accountApi.getAccounts()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (accounts: Account[]): void => {
          this.accounts.set(accounts);
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
   * Handles the save event for the account form.
   * If an account is selected, it updates the existing account; otherwise, it creates a new account.
   * @param formData The form data containing the account details.
   */
  onSave(formData: Account): void {
    const account: Account | null = this.selectedAccount();

    if (account) {
      this.editAccount(account, formData);
    } else {
      this.createAccount(formData);
    }
  }

  /**
   * Creates a new account using the provided account data.
   * @param newAccount The account data to create.
   */
  private createAccount(newAccount: Account): void {
    this.accountApi.create(newAccount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created: Account): void => {
          this.accounts.set([...this.accounts(), created]);

          this.toast.success('Account created successfully');
          this.showDialog.set(false);
        },
        error: (error: any): void => {
          console.error('Error creating account:', error);
          this.toast.error(error.error?.detail || 'Failed to create account');
        }
      });
  }

  /**
   * Edits an existing account using the provided account data.
   * @param existingAccount The account to edit.
   * @param updateFormDate The updated account data.
   */
  private editAccount(existingAccount: Account, updateFormDate: Account): void {
    this.accountApi.update(existingAccount.id, updateFormDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated: Account): void => {
          const accounts: Account[] = this.accounts();
          const index: number = accounts.findIndex((a: Account): boolean => a.id === existingAccount.id);

          if (index !== -1) {
            accounts[index] = updated;
            this.accounts.set([...accounts]);
          }
          this.toast.success('Account updated successfully');
          this.showDialog.set(false);
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
