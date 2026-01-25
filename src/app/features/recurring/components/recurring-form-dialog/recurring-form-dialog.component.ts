import { Component, EventEmitter, inject, input, OnChanges, Output, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { RecurringTransaction, RecurringTransactionDto, Frequency } from '@models/recurring.model';
import { RecurringApiService } from '../../services/recurring-api.service';
import { ToastService } from '@core/services/toast.service';
import { Account } from '@models/account.model';

@Component({
  selector: 'app-recurring-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    Select,
    DatePicker,
    CheckboxModule,
    MessageModule
  ],
  templateUrl: './recurring-form-dialog.component.html'
})
export class RecurringFormDialogComponent implements OnChanges {
  private readonly api = inject(RecurringApiService);
  private readonly toast = inject(ToastService);

  visible = input.required<boolean>();
  transaction = input<RecurringTransaction | null>(null);
  accounts = input<Account[]>([]);

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<void>();

  formData: Partial<RecurringTransactionDto> = {
    merchantName: '',
    amount: 0,
    frequency: Frequency.MONTHLY,
    active: true
  };

  nextDate: Date | null = null;
  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  frequencyOptions = [
    { label: 'Weekly', value: Frequency.WEEKLY },
    { label: 'Bi-Weekly', value: Frequency.BI_WEEKLY },
    { label: 'Monthly', value: Frequency.MONTHLY },
    { label: 'Quarterly', value: Frequency.QUARTERLY },
    { label: 'Yearly', value: Frequency.YEARLY }
  ];

  accountOptions = signal<{ label: string, value: number }[]>([]);

  ngOnChanges(): void {
    if (this.visible()) {
      this.accountOptions.set(
        this.accounts().map(a => ({ label: a.name, value: a.id }))
      );

      const txn = this.transaction();
      if (txn) {
        this.formData = {
          merchantName: txn.merchantName,
          amount: txn.amount,
          frequency: txn.frequency,
          active: txn.active,
          accountId: txn.accountId
        };
        this.nextDate = new Date(txn.nextDate);
      } else {
        this.resetForm();
      }
    }
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    if (!this.formData.merchantName || !this.formData.amount || !this.nextDate) {
      this.errorMessage.set('Merchant Name, Amount, and Next Due Date are required');
      return;
    }

    this.loading.set(true);

    const dto: RecurringTransactionDto = {
      ...this.formData as RecurringTransactionDto,
      nextDate: this.toISODate(this.nextDate)
    };

    if (this.transaction()) {
      this.api.updateRecurringTransaction(this.transaction()!.id, dto).subscribe({
        next: () => this.handleSuccess('Updated successfully'),
        error: (err) => this.handleError(err)
      });
    } else {
      this.api.createRecurringTransaction(dto).subscribe({
        next: () => this.handleSuccess('Created successfully'),
        error: (err) => this.handleError(err)
      });
    }
  }

  private handleSuccess(msg: string): void {
    this.toast.success(msg);
    this.save.emit();
    this.onHide();
    this.loading.set(false);
  }

  private handleError(error: any): void {
    this.errorMessage.set(error.error?.detail || 'Operation failed');
    this.loading.set(false);
  }

  private resetForm(): void {
    this.formData = {
      merchantName: '',
      amount: 0,
      frequency: Frequency.MONTHLY,
      active: true,
      accountId: undefined
    };
    this.nextDate = null;
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  private toISODate(date: Date): string {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  }

  get isEditMode(): boolean {
    return this.transaction() !== null;
  }
}
