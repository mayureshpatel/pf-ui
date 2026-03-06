import {Component, computed, inject, input, InputSignal, model, ModelSignal, OnChanges, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {Select, SelectModule} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {DatePicker} from 'primeng/datepicker';
import {RadioButtonModule} from 'primeng/radiobutton';
import {DividerModule} from 'primeng/divider';
import {Transaction, TransactionFormData, TransactionType} from '@models/transaction.model';
import {Account} from '@models/account.model';
import {Category, CategoryGroup, CategoryType} from '@models/category.model';
import {Merchant} from '@models/merchant.model';
import {TRANSACTION_TYPE_INFO} from '@shared/utils/transaction.utils';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {MessageService} from 'primeng/api';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

interface AccountOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-transaction-form-drawer',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    Select,
    SelectModule,
    InputNumberModule,
    MessageModule,
    DatePicker,
    RadioButtonModule,
    DividerModule,
    DrawerComponent
  ],
  templateUrl: './transaction-form-drawer.component.html'
})
export class TransactionFormDrawerComponent implements OnChanges {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly messageService: MessageService = inject(MessageService);

  // input signals
  visible: ModelSignal<boolean> = model.required<boolean>();
  transaction: InputSignal<Transaction | null> = input<Transaction | null>(null);
  accounts: InputSignal<Account[]> = input.required<Account[]>();
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  save: OutputEmitterRef<TransactionFormData> = output<TransactionFormData>();

  form = new FormGroup({
    type: new FormControl<TransactionType>(TransactionType.EXPENSE, { nonNullable: true }),
    date: new FormControl<Date>(new Date(), { nonNullable: true, validators: [Validators.required] }),
    account: new FormControl<number | null>(null, { validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.01)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
    merchantName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    category: new FormControl<Category | null>(null)
  });

  // state
  errorMessage: WritableSignal<string | null> = signal(null);
  categoryGroups: WritableSignal<CategoryGroup[]> = signal([]);

  private originalMerchant: Merchant | undefined = undefined;

  TransactionType = TransactionType;
  transactionTypeInfo = TRANSACTION_TYPE_INFO;

  filteredCategoryGroups = computed(() => {
    const type: TransactionType = this.form.value.type ?? TransactionType.EXPENSE;
    const groups: CategoryGroup[] = this.categoryGroups();

    return groups
      .map((group: CategoryGroup) => ({
        label: group.groupLabel,
        value: group.groupId,
        items: group.items
          .filter((category: Category): boolean => {
            if (!category.categoryType || category.categoryType === CategoryType.BOTH) return true;
            if (type === TransactionType.INCOME) return category.categoryType === CategoryType.INCOME;
            if (type === TransactionType.EXPENSE) return category.categoryType === CategoryType.EXPENSE;
            return true;
          })
          .map((category: Category) => ({
            label: category.name,
            value: category,
            icon: category.icon,
            color: category.color
          }))
      }))
      .filter(group => group.items.length > 0);
  });

  accountOptions = computed((): AccountOption[] =>
    this.accounts().map((a: Account) => ({ label: a.name, value: a.id }))
  );

  ngOnChanges(): void {
    this.loadCategories();
    const txn = this.transaction();

    if (txn) {
      this.originalMerchant = txn.merchant;
      this.form.patchValue({
        type: txn.type,
        date: new Date(txn.date),
        account: txn.account.id,
        amount: Math.abs(txn.amount),
        description: txn.description || '',
        merchantName: txn.merchant?.cleanName || '',
        category: txn.category || null
      });
    } else {
      this.originalMerchant = undefined;
      this.form.reset({
        type: TransactionType.EXPENSE,
        date: new Date(),
        account: this.accounts().length > 0 ? this.accounts()[0].id : null,
        amount: null,
        description: '',
        merchantName: '',
        category: null
      });
    }
    this.errorMessage.set(null);
  }

  loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups: CategoryGroup[]): void => this.categoryGroups.set(groups),
      error: (): void => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load categories' });
      }
    });
  }

  onHide(): void {
    setTimeout((): void => {
      this.form.reset({
        type: TransactionType.EXPENSE,
        date: new Date(),
        account: this.accounts().length > 0 ? this.accounts()[0].id : null,
        amount: null,
        description: '',
        merchantName: '',
        category: null
      });
      this.errorMessage.set(null);
      this.originalMerchant = undefined;
    }, 300);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.errorMessage.set('Please fill in all required fields');
      return;
    }

    const { type, date, account, amount, description, merchantName, category } = this.form.getRawValue();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      this.errorMessage.set('Transaction date cannot be in the future');
      return;
    }

    // Resolve merchant: use original if name unchanged, otherwise create partial merchant
    let merchant: Merchant | undefined;
    if (merchantName.trim()) {
      merchant = this.originalMerchant?.cleanName === merchantName.trim()
        ? this.originalMerchant
        : { id: 0, user: null as any, originalName: merchantName.trim(), cleanName: merchantName.trim() };
    } else {
      merchant = this.originalMerchant;
    }

    const formData: TransactionFormData = {
      id: this.transaction()?.id,
      date: this.toISODate(date),
      type: type!,
      account: account!,
      amount: amount!,
      description: description || undefined,
      merchant,
      category: category ?? undefined
    };

    this.save.emit(formData);
  }

  get isEditMode(): boolean {
    return this.transaction() !== null;
  }

  get drawerTitle(): string {
    return this.isEditMode ? 'Edit Transaction' : 'Create Transaction';
  }

  get drawerIcon(): string {
    return this.isEditMode ? 'pi-pencil' : 'pi-plus';
  }

  get maxDate(): Date {
    return new Date();
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
