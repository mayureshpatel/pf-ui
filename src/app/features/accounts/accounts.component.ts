import {Component, computed, DestroyRef, inject, OnInit, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {ConfirmationService} from 'primeng/api';
import {Account, AccountFormData} from '@models/account.model';
import {AccountApiService} from './services/account-api.service';
import {AccountSummaryCardsComponent} from './components/account-summary-cards/account-summary-cards.component';
import {AccountFormDialogComponent} from './components/account-form-dialog/account-form-dialog.component';
import {ToastService} from '@core/services/toast.service';
import {formatCurrency, getAccountTypeInfo} from '@shared/utils/account.utils';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

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
    AccountFormDialogComponent
  ],
  templateUrl: './accounts.component.html'
})
export class AccountsComponent implements OnInit {
  private readonly accountApi = inject(AccountApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  selectedAccount: WritableSignal<Account | null> = signal(null);

  isEmpty = computed(() => this.accounts().length === 0 && !this.loading());

  formatCurrency = formatCurrency;
  getAccountTypeInfo = getAccountTypeInfo;

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.accountApi.getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accounts) => {
          this.accounts.set(accounts);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load accounts');
          this.loading.set(false);
        }
      });
  }

  openCreateDialog(): void {
    this.selectedAccount.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(account: Account): void {
    this.selectedAccount.set(account);
    this.showDialog.set(true);
  }

  onSave(formData: AccountFormData): void {
    const account = this.selectedAccount();

    if (account) {
      // Update existing account
      this.accountApi.updateAccount(account.id, formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            const accounts = this.accounts();
            const index = accounts.findIndex(a => a.id === account.id);
            if (index !== -1) {
              accounts[index] = updated;
              this.accounts.set([...accounts]);
            }
            this.toast.success('Account updated successfully');
            this.showDialog.set(false);
          },
          error: (error) => {
            this.toast.error(error.error?.detail || 'Failed to update account');
          }
        });
    } else {
      // Create new account
      this.accountApi.createAccount(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.accounts.set([...this.accounts(), created]);
            this.toast.success('Account created successfully');
            this.showDialog.set(false);
          },
          error: (error) => {
            this.toast.error(error.error?.detail || 'Failed to create account');
          }
        });
    }
  }

  deleteAccount(account: Account): void {
    this.confirmationService.confirm({
      header: `Delete ${account.name}?`,
      message: 'This will permanently delete the account. This action cannot be undone.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.accountApi.deleteAccount(account.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.accounts.set(this.accounts().filter(a => a.id !== account.id));
              this.toast.success('Account deleted successfully');
            },
            error: (error) => {
              const message = error.error?.detail || 'Failed to delete account';
              this.toast.error(message);
            }
          });
      }
    });
  }

  getBalanceClass(balance: number): string {
    return balance >= 0 ? 'text-green-600' : 'text-red-600';
  }
}
