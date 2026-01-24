import { Component, EventEmitter, input, OnChanges, Output, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { DatePicker } from 'primeng/datepicker';
import { RadioButtonModule } from 'primeng/radiobutton';
import { Transaction, TransactionFormData, TransactionType } from '@models/transaction.model';
import { Account } from '@models/account.model';
import { TRANSACTION_TYPE_INFO } from '@shared/utils/transaction.utils';

interface AccountOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-transaction-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    Select,
    InputNumberModule,
    MessageModule,
    DatePicker,
    RadioButtonModule
  ],
  templateUrl: './transaction-form-dialog.component.html'
})
export class TransactionFormDialogComponent implements OnChanges {
  visible = input.required<boolean>();
  transaction = input<Transaction | null>(null);
  accounts = input.required<Account[]>();
  saving = input<boolean>(false);

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<TransactionFormData>();

  formData: TransactionFormData = {
    date: this.getTodayISO(),
    type: TransactionType.EXPENSE,
    accountId: 0,
    amount: 0
  };

  formDate: Date = new Date();
  errorMessage: WritableSignal<string | null> = signal(null);

  TransactionType = TransactionType;
  transactionTypeInfo = TRANSACTION_TYPE_INFO;

  accountOptions = (): AccountOption[] => {
    return this.accounts().map(a => ({
      label: a.name,
      value: a.id
    }));
  };

  ngOnChanges(): void {
    const txn = this.transaction();
    if (txn) {
      this.formData = {
        date: txn.date,
        type: txn.type,
        accountId: txn.accountId,
        amount: Math.abs(txn.amount),
        description: txn.description || undefined,
        vendorName: txn.vendorName || undefined,
        categoryName: txn.categoryName || undefined
      };
      this.formDate = new Date(txn.date);
    } else {
      this.resetForm();
    }
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    // Validate required fields
    if (!this.formData.date || !this.formData.type || !this.formData.accountId || this.formData.amount <= 0) {
      this.errorMessage.set('Please fill in all required fields');
      return;
    }

    // Validate date is not in future
    const selectedDate = new Date(this.formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      this.errorMessage.set('Transaction date cannot be in the future');
      return;
    }

    this.save.emit(this.formData);
  }

  onDateChange(event: any): void {
    if (event) {
      this.formData.date = this.toISODate(event);
    }
  }

  resetForm(): void {
    const todayISO = this.getTodayISO();
    this.formData = {
      date: todayISO,
      type: TransactionType.EXPENSE,
      accountId: this.accounts().length > 0 ? this.accounts()[0].id : 0,
      amount: 0
    };
    this.formDate = new Date();
    this.errorMessage.set(null);
  }

  get isEditMode(): boolean {
    return this.transaction() !== null;
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Edit Transaction' : 'Create Transaction';
  }

  get maxDate(): Date {
    return new Date();
  }

  private getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
