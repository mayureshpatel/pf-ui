import {
  Component,
  computed,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  OnChanges,
  OnInit,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
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
    FormsModule,
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
export class TransactionFormDrawerComponent implements OnChanges, OnInit {
  // injected services
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly messageService: MessageService = inject(MessageService);

  // input signals
  visible: ModelSignal<boolean> = model.required<boolean>();
  transaction: InputSignal<Transaction | null> = input<Transaction | null>(null);
  accounts: InputSignal<Account[]> = input.required<Account[]>();
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  save: OutputEmitterRef<TransactionFormData> = output<TransactionFormData>();

  formData: TransactionFormData = {
    date: this.getTodayISO(),
    type: TransactionType.EXPENSE,
    description: '',
    account: undefined,
    amount: 0
  };

  // state
  formDate: Date = new Date();
  errorMessage: WritableSignal<string | null> = signal(null);
  categoryGroups: WritableSignal<CategoryGroup[]> = signal([]);

  TransactionType = TransactionType;
  transactionTypeInfo = TRANSACTION_TYPE_INFO;

  // computed signals
  filteredCategoryGroups = computed(() => {
    const type: TransactionType = this.formData.type;
    const groups: CategoryGroup[] = this.categoryGroups();

    return groups
      .map((group: CategoryGroup) => ({
        label: group.groupLabel,
        value: group.groupId,
        items: group.items
          .filter((category: Category): boolean => {
            if (!category.type || category.type === CategoryType.BOTH) return true;
            if (type === TransactionType.INCOME) return category.type === CategoryType.INCOME;
            if (type === TransactionType.EXPENSE) return category.type === CategoryType.EXPENSE;
            return true;
          })
          .map((category: Category) => ({
            label: category.name,
            value: category.id,
            iconography: category.iconography
          }))
      }))
      .filter(group => group.items.length > 0);
  });

  accountOptions = (): AccountOption[] => {
    return this.accounts().map((a: Account) => ({
      label: a.name,
      value: a.id
    }));
  };

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups: CategoryGroup[]): void => this.categoryGroups.set(groups),
      error: (): void => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load categories'
        });
      }
    });
  }

  ngOnChanges(): void {
    const txn: Transaction | null = this.transaction();

    if (txn) {
      this.formData = {
        id: txn.id,
        date: txn.date,
        type: txn.type,
        account: txn.account,
        amount: Math.abs(txn.amount),
        description: txn.description || undefined,
        merchant: txn.merchant || undefined,
        category: txn.category || undefined
      };
      this.formDate = new Date(txn.date);
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

    // Validate required fields
    if (!this.formData.date || !this.formData.type || !this.formData.account || this.formData.amount <= 0) {
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
    const todayISO: string = this.getTodayISO();
    this.formData = {
      date: todayISO,
      type: TransactionType.EXPENSE,
      description: '',
      account: this.accounts().length > 0 ? this.accounts()[0] : undefined,
      amount: 0
    };
    this.formDate = new Date();
    this.errorMessage.set(null);
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

  private getTodayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
