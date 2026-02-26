import {
  Component,
  input,
  InputSignal,
  model,
  ModelSignal,
  OnChanges,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account, AccountType, BankName} from '@models/account.model';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';
import {ReconcileDialogComponent} from '../reconcile-dialog/reconcile-dialog.component';
import {BankOption} from '@models/transaction.model';

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
    DrawerComponent,
    ReconcileDialogComponent
  ],
  templateUrl: './account-form-drawer.component.html'
})
export class AccountFormDrawerComponent implements OnChanges {
  // input signals
  visible: ModelSignal<boolean> = model.required<boolean>();
  account: InputSignal<Account | null> = input<Account | null>(null);
  accountTypes: InputSignal<AccountType[]> = input.required<AccountType[]>();
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  save: OutputEmitterRef<any> = output<any>();

  // signals
  errorMessage: WritableSignal<string | null> = signal(null);
  showReconcileDialog: WritableSignal<boolean> = signal(false);
  selectedBank: WritableSignal<BankOption | undefined> = signal(undefined);

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

  formData = {
    accountName: '',
    accountType: undefined as AccountType | undefined,
    currentBalance: 0,
    bankName: undefined as BankName | undefined
  };

  ngOnChanges(): void {
    const selectedAccount: Account | null = this.account();

    if (selectedAccount) {
      this.formData = {
        accountName: selectedAccount.name,
        accountType: selectedAccount.type,
        currentBalance: selectedAccount.currentBalance,
        bankName: this.selectedBank()?.value
      };
    } else {
      this.resetForm();
    }
  }

  onHide(): void {
    setTimeout((): void => {
      this.resetForm();
    }, 300);
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    if (!this.formData.accountName || !this.formData.accountType || this.formData.currentBalance === null) {
      this.errorMessage.set('Please fill in all required fields');
      return;
    }

    this.save.emit(this.formData);
  }

  resetForm(): void {
    this.formData = {
      accountName: '',
      accountType: undefined,
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

  openReconcileDialog(): void {
    this.showReconcileDialog.set(true);
  }

  onReconciled(): void {
    this.save.emit(this.formData);
    this.visible.set(false);
  }
}
