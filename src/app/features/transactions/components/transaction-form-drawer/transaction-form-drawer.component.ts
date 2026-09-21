import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';

import {
  Transaction,
  TransactionCreateRequest,
  TransactionFormSaveEvent,
  TransactionType,
  TransactionUpdateRequest,
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { finalize, forkJoin, map, Subject, switchMap } from 'rxjs';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { MerchantFormDialogComponent } from '@features/merchants/components/merchant-form-dialog/merchant-form-dialog.component';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Tooltip } from 'primeng/tooltip';
import { SelectItemGroup } from 'primeng/api';

/** Sentinel id marking the synthetic "+ Create '<query>'" autocomplete suggestion -- always
 *  negative, so it can never collide with a real (positive, @Positive-validated) merchant id. */
const CREATE_MERCHANT_SENTINEL_ID = -1;

/**
 * Drawer component for creating or editing individual ledger transactions.
 *
 * Implements a signal-first architecture for reactive form synchronization
 * and features intelligent autocomplete for merchants and categories.
 */
@Component({
  selector: 'app-transaction-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AutoCompleteModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    DatePicker,
    MessageModule,
    DrawerComponent,
    ProgressSpinner,
    Tooltip,
    MerchantFormDialogComponent,
  ],
  templateUrl: './transaction-form-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFormDrawerComponent {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly tagApi: TagApiService = inject(TagApiService);

  /** Two-way binding for drawer visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The transaction being edited, or null for creation mode. */
  readonly transaction: InputSignal<Transaction | null> = input<Transaction | null>(null);

  /** Indicates if a save operation is in flight. */
  readonly saving: InputSignal<boolean> = input(false);

  /** Indicates if the drawer is currently loading data. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Emitted when the form is validated and ready for persistence. */
  readonly save: OutputEmitterRef<TransactionFormSaveEvent> = output<TransactionFormSaveEvent>();

  /** Available bank accounts for transaction association. */
  readonly accounts: WritableSignal<Account[]> = signal<Account[]>([]);

  /** Available categories for classification. */
  readonly groupedCategories: WritableSignal<SelectItemGroup[]> = signal<SelectItemGroup[]>([]);

  /** Available tags for assignment. */
  readonly tags: WritableSignal<Tag[]> = signal<Tag[]>([]);

  /** Error message to display. */
  readonly errorMessage: WritableSignal<string | null> = signal(null);

  /** Filtered suggestions for the category autocomplete. */
  readonly filteredCategories: WritableSignal<Category[]> = signal([]);

  /** Filtered suggestions for the merchant autocomplete. */
  readonly filteredMerchants: WritableSignal<Merchant[]> = signal([]);

  /** Options for the transaction type selector. */
  readonly typeOptions = [
    {
      label: 'Expense',
      value: TransactionType.EXPENSE,
      icon: 'pi-minus-circle',
      color: 'text-rose-500',
    },
    {
      label: 'Income',
      value: TransactionType.INCOME,
      icon: 'pi-plus-circle',
      color: 'text-emerald-500',
    },
    {
      label: 'Transfer',
      value: TransactionType.TRANSFER,
      icon: 'pi-sync',
      color: 'text-surface-500',
    },
  ];

  /**
   * Strongly typed reactive form for transaction details.
   */
  readonly form = new FormGroup({
    id: new FormControl<number | null>({ value: null, disabled: true }),
    accountId: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    transactionDate: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl<string>('', { nonNullable: true }),
    type: new FormControl<TransactionType>(TransactionType.EXPENSE, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    category: new FormControl<Category | null>(null, { validators: [Validators.required] }),
    postDate: new FormControl<string | null>(null),
    merchant: new FormControl<Merchant | null>(null),
    tags: new FormControl<Tag[]>([], { nonNullable: true }),
  });

  /** Indicates if the component is in edit mode. */
  readonly isEditMode: Signal<boolean> = computed((): boolean => this.transaction() !== null);

  /** Title displayed in the drawer header. */
  readonly drawerTitle: Signal<string> = computed((): string =>
    this.isEditMode() ? 'Edit Transaction' : 'New Transaction',
  );

  /** Reactive signal bridge for the merchant form control value. */
  private readonly selectedMerchant: WritableSignal<Merchant | null> = signal<Merchant | null>(
    null,
  );

  /** Visibility of the inline "create a new merchant" dialog, opened from the merchant
   *  autocomplete's synthetic "+ Create" suggestion. */
  readonly showCreateMerchantDialog: WritableSignal<boolean> = signal(false);

  /** The typed query to pre-fill the inline-create dialog's name field with. */
  readonly createMerchantSeedName: WritableSignal<string> = signal('');

  /** The most recently issued merchant search query -- read back when the "+ Create" suggestion
   *  is selected, since the selection event itself only carries the (synthetic) chosen option. */
  private lastMerchantQuery = '';

  /** Drives the merchant autocomplete's search-as-you-type requests (PF-320): the merchant list
   *  is no longer preloaded in full, since it now grows unboundedly with a user's transaction
   *  history -- switchMap cancels any still-in-flight search when a newer keystroke arrives. */
  private readonly merchantSearch$: Subject<string> = new Subject<string>();

  constructor() {
    this.loadData();

    this.merchantSearch$
      .pipe(
        switchMap((query: string) =>
          this.merchantApi
            .getMerchants(query, { page: 0, size: 20 })
            .pipe(map((page) => ({ query, merchants: page.content }))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ query, merchants }): void => {
        this.lastMerchantQuery = query;
        this.filteredMerchants.set(this.withCreateSuggestion(query, merchants));
      });
  }

  /**
   * Appends a synthetic "+ Create '<query>'" suggestion when the typed text has no exact match
   * among the returned merchants -- lets the user create a new merchant inline instead of being
   * forced to pick an existing (possibly wrong) one.
   * @param query the raw typed search text
   * @param merchants the server's search results for that query
   * @return the suggestions to display, with the synthetic option appended when applicable
   */
  private withCreateSuggestion(query: string, merchants: Merchant[]): Merchant[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return merchants;
    }
    const hasExactMatch = merchants.some(
      (m): boolean => m.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (hasExactMatch) {
      return merchants;
    }
    return [
      ...merchants,
      {
        id: CREATE_MERCHANT_SENTINEL_ID,
        userId: 0,
        name: `+ Create "${trimmed}"`,
        city: null,
        state: null,
        postalCode: null,
        country: null,
      },
    ];
  }

  /**
   * `true` for the synthetic "+ Create" suggestion, used by the template to style it distinctly
   * from real merchant options.
   * @param merchant the autocomplete option being rendered
   */
  isCreateSuggestion(merchant: Merchant): boolean {
    return merchant.id === CREATE_MERCHANT_SENTINEL_ID;
  }

  /**
   * Intercepts a selection from the merchant autocomplete. A real merchant is left as-is (already
   * bound via `formControlName`); the synthetic "+ Create" option is never allowed to land in the
   * form -- instead it opens the inline create dialog, pre-filled with the typed name.
   * @param merchant the selected option
   */
  onMerchantSelect(merchant: Merchant): void {
    if (!this.isCreateSuggestion(merchant)) {
      return;
    }
    this.form.controls.merchant.setValue(null);
    this.createMerchantSeedName.set(this.lastMerchantQuery.trim());
    this.showCreateMerchantDialog.set(true);
  }

  /**
   * Patches the transaction form with the merchant just created inline, as if the user had
   * picked it from the list themselves.
   * @param merchant the newly created merchant
   */
  onMerchantCreated(merchant: Merchant): void {
    this.form.controls.merchant.setValue(merchant);
  }

  loadData(): void {
    this.loading.set(true);

    forkJoin({
      categories: this.categoryApi.getCategories(),
      accounts: this.accountApi.getAccounts(),
      tags: this.tagApi.getTags(),
    })
      .pipe(
        takeUntilDestroyed(),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ categories, accounts, tags }: any): void => {
          accounts.sort((a: Account, b: Account): number => a.name.localeCompare(b.name));
          this.accounts.set(accounts);
          this.groupedCategories.set(this.getGroupedCategories(categories));
          this.tags.set(tags);

          this.filteredCategories.set(categories);
        },
        error: (error: any): void => {
          console.error('Error loading data:', error);
        },
      });
  }

  getGroupedCategories(categories: Category[]): SelectItemGroup[] {
    categories.sort((a: Category, b: Category): number => {
      // if both are parents, sort by name
      if (!a.parent && !b.parent) {
        return a.name.localeCompare(b.name);
      }
      // if both are children, sort by name
      else if (a.parent && b.parent) {
        return a.name.localeCompare(b.name);
      }
      // if a is a parent and b is a child
      else if (a.parent && !b.parent) {
        return 1;
      }
      // if b is a parent and a is a child
      else if (!a.parent && b.parent) {
        return -1;
      }

      return 0;
    });

    const groupedCategoriesMap = new Map<number, SelectItemGroup>();
    categories.forEach((category: Category): void => {
      if (!category.parent) {
        const header = {
          label: category.name,
          value: category,
          items: [],
        };
        groupedCategoriesMap.set(category.id, header);
      } else {
        const parentId = category.parent.id;
        const parentHeader = groupedCategoriesMap.get(parentId);

        if (parentHeader) {
          parentHeader.items.push({
            label: category.name,
            value: category,
          });
        }
      }
    });

    return Array.from(groupedCategoriesMap.values());
  }

  /**
   * Searches merchants server-side based on user input (PF-320).
   */
  filterMerchants(event: any): void {
    this.merchantSearch$.next(event.query);
  }

  onShow(): void {
    this.form.reset();
    this.errorMessage.set(null);

    const transaction: Transaction | null = this.transaction();

    if (transaction) {
      this.form.patchValue({
        transactionDate: transaction.date.substring(0, 10),
        amount: Math.abs(transaction.amount),
        description: transaction.description,
        type: transaction.type,
        category: transaction.category,
        merchant: transaction.merchant,
        accountId: transaction.account.id,
        tags: transaction.tags ?? [],
      });
    } else {
      this.form.patchValue({
        transactionDate: toLocalDateString(new Date()),
        amount: 0,
        description: '',
        type: TransactionType.EXPENSE,
        category: null,
        merchant: null,
        accountId: 0,
        tags: [],
      });
    }
  }

  /**
   * Validates and submits the form data.
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const selectedTransaction: Transaction | null = this.transaction();
    const tagIds: number[] = rawValue.tags.map((t: Tag): number => t.id);

    if (selectedTransaction) {
      const updateRequest: TransactionUpdateRequest = {
        id: selectedTransaction.id,
        accountId: rawValue.accountId,
        amount: rawValue.amount,
        transactionDate: rawValue.transactionDate,
        description: rawValue.description ?? '',
        type: rawValue.type,
        categoryId: rawValue.category!.id,
        // PF-317: neither postDate nor merchant has Validators.required (unlike category,
        // asserted safely above) -- the generated TransactionUpdateRequest type now correctly
        // reflects that the backend agrees (no @NotNull on either field), so these are plain
        // optional-chains rather than asserted-then-disabled-lint non-null casts.
        postDate: rawValue.postDate ?? undefined,
        merchantId: rawValue.merchant?.id,
      };

      this.save.emit({ request: updateRequest, tagIds });
    } else {
      const createRequest: TransactionCreateRequest = {
        accountId: rawValue.accountId,
        amount: rawValue.amount,
        transactionDate: rawValue.transactionDate,
        description: rawValue.description ?? '',
        type: rawValue.type,
        categoryId: rawValue.category!.id,
        // PF-317: see the matching comment in the update-request branch above -- postDate/merchant
        // are genuinely optional per the generated (backend-sourced) type, not a lying assertion.
        postDate: rawValue.postDate ?? undefined,
        merchantId: rawValue.merchant?.id,
      };

      this.save.emit({ request: createRequest, tagIds });
    }
  }
}
