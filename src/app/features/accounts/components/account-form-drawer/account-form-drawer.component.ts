import {
  Component,
  computed,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account, AccountCreateRequest, AccountType, AccountUpdateRequest, BankName} from '@models/account.model';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';
import {BankOption} from '@models/transaction.model';
import {ReconcileDialogComponent} from '@features/accounts/components/reconcile-dialog/reconcile-dialog.component';

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
export class AccountFormDrawerComponent {
  visible: ModelSignal<boolean> = model.required<boolean>();
  account: InputSignal<Account | null> = input<Account | null>(null);
  accountTypes: InputSignal<AccountType[]> = input.required<AccountType[]>();
  saving: InputSignal<boolean> = input<boolean>(false);

  save: OutputEmitterRef<AccountUpdateRequest | AccountCreateRequest> = output<AccountUpdateRequest | AccountCreateRequest>();
  reconcile: OutputEmitterRef<void> = output<void>();

  errorMessage: WritableSignal<string | null> = signal(null);
  showReconcileDialog: WritableSignal<boolean> = signal(false);

  isEditMode: Signal<boolean> = computed((): boolean => this.account() !== null);
  drawerTitle: Signal<string> = computed((): string => this.isEditMode() ? 'Edit Account' : 'Create Account');
  drawerIcon: Signal<string> = computed((): string => this.isEditMode() ? 'pi-wallet' : 'pi-plus');

  bankOptions: BankOption[] = [
    {label: 'Standard CSV', value: BankName.STANDARD, description: 'Generic format (Date, Description, Amount, Type)'},
    {label: 'Capital One', value: BankName.CAPITAL_ONE, description: 'Capital One bank export format'},
    {label: 'Discover', value: BankName.DISCOVER, description: 'Discover credit card export format'},
    {label: 'Synovus', value: BankName.SYNOVUS, description: 'Synovus bank export format'},
    {label: 'Universal CSV', value: BankName.UNIVERSAL, description: 'Auto-detect columns (Date, Amount, Description)'}
  ];

  private readonly defaultCurrency: string = Intl.NumberFormat().resolvedOptions().currency ?? 'USD';

  form = new FormGroup({
    id: new FormControl<number | null>({value: null, disabled: true}),
    name: new FormControl('', {
      nonNullable: true, validators: [Validators.required, Validators.maxLength(100)]
    }),
    type: new FormControl<AccountType | null>(null, {validators: [Validators.required]}),
    currencyCode: new FormControl({value: this.defaultCurrency, disabled: true}, {
      nonNullable: true, validators: [Validators.required]
    }),
    currentBalance: new FormControl(0, {nonNullable: true, validators: [Validators.required]}),
    bankName: new FormControl<BankName | null>(null)
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const selectedAccount: Account | null = this.account();

    if (selectedAccount) {
      const updateRequest: AccountUpdateRequest = {
        id: selectedAccount.id,
        name: rawValue.name,
        type: rawValue.type!.code,
        currencyCode: rawValue.currencyCode,
        bankName: rawValue.bankName ?? '',
        version: selectedAccount.version
      };

      this.save.emit(updateRequest);
    } else {
      const createRequest: AccountCreateRequest = {
        name: rawValue.name,
        type: rawValue.type!.code,
        startingBalance: rawValue.currentBalance,
        currencyCode: rawValue.currencyCode,
        bankName: rawValue.bankName ?? ''
      };

      this.save.emit(createRequest);
    }
  }

  onShow(): void {
    this.form.reset();
    this.errorMessage.set(null);
    this.showReconcileDialog.set(false);

    const account: Account | null = this.account();

    if (account) {
      this.form.patchValue({
        id: account.id,
        name: account.name,
        type: account.type,
        currencyCode: account.currency.code,
        currentBalance: account.currentBalance,
        bankName: account.bank
      });
      this.form.controls.currentBalance.disable();
    } else {
      this.form.patchValue({
        id: null,
        name: '',
        type: null,
        currencyCode: this.defaultCurrency,
        currentBalance: 0,
        bankName: null
      });
      this.form.controls.currentBalance.enable();
    }
  }

  openReconcileDialog(): void {
    this.showReconcileDialog.set(true);
  }
}
