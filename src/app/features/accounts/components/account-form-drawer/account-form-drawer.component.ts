import {Component, EventEmitter, input, OnChanges, Output, signal, WritableSignal, model} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account, AccountFormData, AccountType} from '@models/account.model';
import {BankName, BankOption} from '@models/transaction.model';
import {ACCOUNT_TYPE_INFO} from '@shared/utils/account.utils';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

interface AccountTypeOption {
  label: string;
  value: AccountType;
  icon: string;
}

@Component({
  selector: 'app-account-form-drawer',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Select,
    InputNumberModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './account-form-drawer.component.html'
})
export class AccountFormDrawerComponent implements OnChanges {
  visible = model.required<boolean>();
  account = input<Account | null>(null);
  saving = input<boolean>(false);

  @Output() save = new EventEmitter<AccountFormData>();

  formData: AccountFormData = {
    name: '',
    type: AccountType.CHECKING,
    currentBalance: 0,
    bankName: undefined
  };

  errorMessage: WritableSignal<string | null> = signal(null);

  accountTypes: AccountTypeOption[] = Object.values(AccountType).map(type => ({
    label: ACCOUNT_TYPE_INFO[type].label,
    value: type,
    icon: ACCOUNT_TYPE_INFO[type].icon
  }));

  bankOptions: BankOption[] = [
    {
      label: 'Standard CSV',
      value: BankName.STANDARD,
      description: 'Generic format (Date, Description, Amount, Type)'
    },
    {
      label: 'Capital One',
      value: BankName.CAPITAL_ONE,
      description: 'Capital One bank export format'
    },
    {
      label: 'Discover',
      value: BankName.DISCOVER,
      description: 'Discover credit card export format'
    },
    {
      label: 'Synovus',
      value: BankName.SYNOVUS,
      description: 'Synovus bank export format'
    },
    {
      label: 'Universal CSV',
      value: BankName.UNIVERSAL,
      description: 'Auto-detect columns (Date, Amount, Description)'
    }
  ];

  ngOnChanges(): void {
    const acc = this.account();
    if (acc) {
      this.formData = {
        name: acc.name,
        type: acc.type,
        currentBalance: acc.currentBalance,
        bankName: acc.bankName
      };
    } else {
      this.resetForm();
    }
  }

  onHide(): void {
    setTimeout(() => {
      this.resetForm();
    }, 300);
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    if (!this.formData.name || !this.formData.type || this.formData.currentBalance === null) {
      this.errorMessage.set('Please fill in all required fields');
      return;
    }

    this.save.emit(this.formData);
  }

  resetForm(): void {
    this.formData = {
      name: '',
      type: AccountType.CHECKING,
      currentBalance: 0,
      bankName: undefined
    };
    this.errorMessage.set(null);
  }

  get isEditMode(): boolean {
    return this.account() !== null;
  }

  get drawerTitle(): string {
    return this.isEditMode ? 'Edit Account' : 'Create Account';
  }

  get drawerIcon(): string {
    return this.isEditMode ? 'pi-wallet' : 'pi-plus';
  }
}