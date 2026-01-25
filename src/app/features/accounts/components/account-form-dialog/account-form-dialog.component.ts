import {Component, EventEmitter, input, OnChanges, Output, signal, WritableSignal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account, AccountFormData, AccountType} from '@models/account.model';
import {ACCOUNT_TYPE_INFO} from '@shared/utils/account.utils';

interface AccountTypeOption {
  label: string;
  value: AccountType;
  icon: string;
}

@Component({
  selector: 'app-account-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    Select,
    InputNumberModule,
    MessageModule
  ],
  templateUrl: './account-form-dialog.component.html'
})
export class AccountFormDialogComponent implements OnChanges {
  visible = input.required<boolean>();
  account = input<Account | null>(null);

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<AccountFormData>();

  formData: AccountFormData = {
    name: '',
    type: AccountType.CHECKING,
    currentBalance: 0
  };

  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  accountTypes: AccountTypeOption[] = Object.values(AccountType).map(type => ({
    label: ACCOUNT_TYPE_INFO[type].label,
    value: type,
    icon: ACCOUNT_TYPE_INFO[type].icon
  }));

  ngOnChanges(): void {
    const acc = this.account();
    if (acc) {
      this.formData = {
        name: acc.name,
        type: acc.type,
        currentBalance: acc.currentBalance
      };
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

    if (!this.formData.name || !this.formData.type || this.formData.currentBalance === null) {
      this.errorMessage.set('Please fill in all required fields');
      return;
    }

    this.loading.set(true);
    this.save.emit(this.formData);
  }

  resetForm(): void {
    this.formData = {
      name: '',
      type: AccountType.CHECKING,
      currentBalance: 0
    };
    this.errorMessage.set(null);
    this.loading.set(false);
  }

  get isEditMode(): boolean {
    return this.account() !== null;
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Edit Account' : 'Create Account';
  }
}
