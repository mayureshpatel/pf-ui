import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ConfirmationService } from 'primeng/api';
import { RecurringTransaction } from '@models/recurring.model';
import { RecurringApiService } from './services/recurring-api.service';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { Account } from '@models/account.model';
import { RecurringFormDialogComponent } from '@shared/components/recurring-form-dialog/recurring-form-dialog.component';
import { RecurringScanDialogComponent } from './components/recurring-scan-dialog/recurring-scan-dialog.component';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency } from '@shared/utils/account.utils';
import { formatDate } from '@shared/utils/transaction.utils';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';

@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    TagModule,
    ScreenToolbarComponent,
    RecurringFormDialogComponent,
    RecurringScanDialogComponent
  ],
  templateUrl: './recurring.component.html'
})
export class RecurringComponent implements OnInit {
  private readonly recurringApi = inject(RecurringApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);

  recurringTransactions: WritableSignal<RecurringTransaction[]> = signal([]);
  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showScanDialog: WritableSignal<boolean> = signal(false);
  selectedTransaction: WritableSignal<RecurringTransaction | null> = signal(null);

  formatCurrency = formatCurrency;
  formatDate = formatDate;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.accountApi.getAccounts().subscribe(accs => this.accounts.set(accs));
    
    this.recurringApi.getRecurringTransactions().subscribe({
      next: (data) => {
        const accMap = new Map(this.accounts().map(a => [a.id, a.name]));
        const enriched = data.map(rt => ({
          ...rt,
          accountName: rt.accountId ? accMap.get(rt.accountId) : undefined
        }));
        this.recurringTransactions.set(enriched);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load recurring transactions');
        this.loading.set(false);
      }
    });
  }

  openCreateDialog(): void {
    this.selectedTransaction.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(txn: RecurringTransaction): void {
    this.selectedTransaction.set(txn);
    this.showDialog.set(true);
  }

  openScanDialog(): void {
    this.showScanDialog.set(true);
  }

  onSave(): void {
    this.loadData();
  }

  deleteRecurring(txn: RecurringTransaction): void {
    this.confirmationService.confirm({
      header: 'Delete Recurring Transaction?',
      message: `Are you sure you want to stop tracking "${txn.merchantName}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.recurringApi.deleteRecurringTransaction(txn.id).subscribe({
          next: () => {
            this.toast.success('Deleted successfully');
            this.loadData();
          },
          error: (err) => this.toast.error(err.error?.detail || 'Failed to delete')
        });
      }
    });
  }

  getDaysUntilDue(dateStr: string): number {
    const due = new Date(dateStr);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDueStatusSeverity(days: number): 'success' | 'warn' | 'danger' | 'info' {
    if (days < 0) return 'danger'; // Overdue
    if (days <= 3) return 'warn';   // Due soon
    return 'info';
  }

  getDueStatusLabel(days: number): string {
    if (days < 0) return `Overdue by ${Math.abs(days)} days`;
    if (days === 0) return 'Due Today';
    if (days === 1) return 'Due Tomorrow';
    return `Due in ${days} days`;
  }
}
