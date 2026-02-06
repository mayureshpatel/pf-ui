import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
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
import {AccountFormDrawerComponent} from './components/account-form-drawer/account-form-drawer.component';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {finalize} from 'rxjs';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';
import {AccountTypeInfoPipe} from '@shared/pipes/account-type-info.pipe';

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
    FormatCurrencyPipe,
    AccountTypeInfoPipe
  ],
  templateUrl: './accounts.component.html'
})
export class AccountsComponent implements OnInit {
  // injected services
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // signals
  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  selectedAccount: WritableSignal<Account | null> = signal(null);

  // computed signals
  isEmpty: Signal<boolean> = computed((): boolean => this.accounts().length === 0 && !this.loading());

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.accountApi.getAccounts()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (accounts: Account[]): void => {
          this.accounts.set(accounts);
        },
        error: (): void => {
          this.toast.error('Failed to load accounts');
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
      this.accountApi.update(account.id, formData)
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
          error: (error: any) => {
            this.toast.error(error.error?.detail || 'Failed to update account');
          }
        });
    } else {
      // Create new account
      this.accountApi.create(formData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.accounts.set([...this.accounts(), created]);
            this.toast.success('Account created successfully');
            this.showDialog.set(false);
          },
          error: (error: any) => {
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
        this.accountApi.delete(account.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.accounts.set(this.accounts().filter(a => a.id !== account.id));
              this.toast.success('Account deleted successfully');
            },
            error: (error: any) => {
              const message = error.error?.detail || 'Failed to delete account';
              this.toast.error(message);
            }
          });
      }
    });
  }
}
