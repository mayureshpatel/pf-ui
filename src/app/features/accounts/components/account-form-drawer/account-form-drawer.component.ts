import {Component, input, InputSignal, model, ModelSignal, OnChanges, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account, AccountFormData, AccountType, BankName} from '@models/account.model';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';
import {ReconcileDialogComponent} from '../reconcile-dialog/reconcile-dialog.component';
import {BankOption} from '@models/transaction.model';

@Component({
  selector: 'app-account-form-drawer',
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  save: OutputEmitterRef<AccountFormData> = output<AccountFormData>();

  // signals
  errorMessage: WritableSignal<string | null> = signal(null);
  showReconcileDialog: WritableSignal<boolean> = signal(false);

  bankOptions: BankOption[] = [
    { label: 'Standard CSV', value: BankName.STANDARD, description: 'Generic format (Date, Description, Amount, Type)' },
    { label: 'Capital One', value: BankName.CAPITAL_ONE, description: 'Capital One bank export format' },
    { label: 'Discover', value: BankName.DISCOVER, description: 'Discover credit card export format' },
    { label: 'Synovus', value: BankName.SYNOVUS, description: 'Synovus bank export format' },
    { label: 'Universal CSV', value: BankName.UNIVERSAL, description: 'Auto-detect columns (Date, Amount, Description)' }
  ];

  form = new FormGroup({
    accountName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    accountType: new FormControl<AccountType | null>(null, { validators: [Validators.required] }),
    currentBalance: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required] }),
    bankName: new FormControl<BankName | null>(null)
  });

  ngOnChanges(): void {
    const selectedAccount = this.account();
    if (selectedAccount) {
      this.form.patchValue({
        accountName: selectedAccount.name,
        accountType: selectedAccount.type,
        currentBalance: selectedAccount.currentBalance,
        bankName: selectedAccount.bank ?? null
      });
    } else {
      this.form.reset({ accountName: '', accountType: null, currentBalance: 0, bankName: null });
    }
    this.errorMessage.set(null);
  }

  onHide(): void {
    setTimeout((): void => {
      this.form.reset({ accountName: '', accountType: null, currentBalance: 0, bankName: null });
      this.errorMessage.set(null);
    }, 300);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.save.emit(this.form.getRawValue());
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
    this.save.emit(this.form.getRawValue());
    this.visible.set(false);
  }
}
