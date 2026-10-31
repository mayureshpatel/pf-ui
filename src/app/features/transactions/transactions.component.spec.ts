import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TransactionEditFormComponent } from './components/transaction-edit-form/transaction-edit-form.component';
import { TransactionsComponent } from './transactions.component';
import { TransactionApiService } from './services/transaction-api.service';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { ToastService } from '@core/services/toast.service';
import { DashboardApiService } from '@features/dashboard/services/dashboard-api.service';
import { ActionType } from '@models/dashboard.model';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi, Mock, Mocked } from 'vitest';
import {
  PageResponse,
  Transaction,
  TransactionCreateRequest,
  TransactionFilter,
  TransactionFormSaveEvent,
  TransactionUpdateRequest,
} from '@models/transaction.model';
import { BulkEditData } from './components/transaction-bulk-form/transaction-bulk-form.component';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';

/** Reproduces just the 2 ActivatedRoute members this component actually reads. */
interface MockActivatedRoute {
  snapshot: { queryParams: Params };
  queryParams: Observable<Params>;
}

describe('TransactionsComponent', () => {
  let component: TransactionsComponent;
  let fixture: ComponentFixture<TransactionsComponent>;
  let mockTransactionApi: Mocked<
    Pick<
      TransactionApiService,
      | 'getTransactions'
      | 'deleteTransaction'
      | 'createTransaction'
      | 'updateTransaction'
      | 'bulkUpdateTransactions'
      | 'markAsTransfer'
      | 'unmarkAsTransfer'
      | 'getTransferSuggestions'
    >
  >;
  let mockAccountApi: Mocked<Pick<AccountApiService, 'getAccounts'>>;
  let mockCategoryApi: Mocked<
    Pick<
      CategoryApiService,
      | 'getCategories'
      | 'getCategoriesWithTransactions'
      | 'getMerchantsWithTransactions'
      | 'getGroupedCategories'
    >
  >;
  let mockMerchantApi: Mocked<Pick<MerchantApiService, 'getMerchants'>>;
  let mockTagApi: Mocked<
    Pick<TagApiService, 'getTags' | 'assignToTransaction' | 'removeFromTransaction'>
  >;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockDashboardApi: Mocked<Pick<DashboardApiService, 'getActionItems'>>;
  let mockConfirmationService: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: Mocked<Pick<Router, 'navigate'>>;
  let mockActivatedRoute: MockActivatedRoute;

  /**
   * The list loads (page size above 1). A period-only page that comes back empty also sends a
   * one-row probe for "does anything exist" (PF-867), which is not a reload.
   */
  const listLoads = (): unknown[][] =>
    mockTransactionApi.getTransactions.mock.calls.filter(([, paging]) => paging.size !== 1);

  beforeEach(async () => {
    mockTransactionApi = {
      getTransactions: vi.fn().mockReturnValue(
        of({
          content: [],
          page: { totalElements: 0, totalPages: 0, number: 0, size: 20 },
        }),
      ),
      deleteTransaction: vi.fn(),
      createTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      bulkUpdateTransactions: vi.fn(),
      markAsTransfer: vi.fn(),
      unmarkAsTransfer: vi.fn(),
      getTransferSuggestions: vi.fn().mockReturnValue(of([])),
    };
    mockAccountApi = {
      getAccounts: vi.fn().mockReturnValue(of([])),
    };
    mockCategoryApi = {
      getCategories: vi.fn().mockReturnValue(of([])),
      getCategoriesWithTransactions: vi.fn().mockReturnValue(of([])),
      getMerchantsWithTransactions: vi.fn().mockReturnValue(of([])),
      getGroupedCategories: vi.fn().mockReturnValue(of([])), // consumed by the child TransactionBulkFormComponent
    };
    mockMerchantApi = {
      getMerchants: vi.fn().mockReturnValue(of([])),
    };
    mockTagApi = {
      getTags: vi.fn().mockReturnValue(of([])),
      assignToTransaction: vi.fn().mockReturnValue(of(undefined)),
      removeFromTransaction: vi.fn().mockReturnValue(of(undefined)),
    };
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };
    mockDashboardApi = { getActionItems: vi.fn().mockReturnValue(of([])) };
    mockConfirmationService = {
      confirm: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockActivatedRoute = {
      snapshot: { queryParams: {} },
      queryParams: of({}),
    };

    await TestBed.configureTestingModule({
      imports: [TransactionsComponent, NoopAnimationsModule],
      providers: [
        { provide: TransactionApiService, useValue: mockTransactionApi },
        { provide: AccountApiService, useValue: mockAccountApi },
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: TagApiService, useValue: mockTagApi },
        { provide: ToastService, useValue: mockToast },
        { provide: DashboardApiService, useValue: mockDashboardApi },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: MessageService, useValue: {} },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('openCreateDialog / openEditDialog (PF-397)', () => {
    it('openCreateDialog should clear any selected transaction and open the panel in create mode', () => {
      // arrange -- simulate a prior edit having left a transaction selected
      component.selectedTransaction.set({ id: 1 } as Transaction);

      // act
      component.openCreateDialog();

      // assert & verify
      expect(component.selectedTransaction()).toBeNull();
      expect(component.panelMode()).toBe('create');
    });

    it('openEditDialog should select the given transaction and open the panel in single mode', () => {
      // arrange
      const txn = { id: 42, description: 'Coffee' } as Transaction;

      // act
      component.openEditDialog(txn);

      // assert & verify
      expect(component.selectedTransaction()).toBe(txn);
      expect(component.panelMode()).toBe('single');
    });
  });

  describe('onSave: create vs. update branching (PF-397)', () => {
    const formData = {
      accountId: 1,
      amount: 10,
      transactionDate: '2026-03-01',
      description: 'Coffee',
      type: 'EXPENSE',
      categoryId: 1,
      merchantId: 1,
    };

    it('should call createTransaction (never updateTransaction) when no transaction is selected', () => {
      // arrange
      component.selectedTransaction.set(null);
      mockTransactionApi.createTransaction.mockReturnValue(of(99));

      // act
      component.onSave({ request: formData as TransactionCreateRequest, tagIds: [] });

      // assert & verify -- create payload has no `id` field at all
      expect(mockTransactionApi.createTransaction).toHaveBeenCalledWith(
        expect.not.objectContaining({ id: expect.anything() }),
      );
      expect(mockTransactionApi.updateTransaction).not.toHaveBeenCalled();
    });

    it('should call updateTransaction (never createTransaction) when a transaction is selected', () => {
      // arrange
      const existing = { id: 42, tags: [] } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1));

      // act
      component.onSave({
        request: { ...formData, id: 42 } as TransactionUpdateRequest,
        tagIds: [],
      });

      // assert & verify -- update payload carries the existing transaction's own id
      expect(mockTransactionApi.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
      );
      expect(mockTransactionApi.createTransaction).not.toHaveBeenCalled();
    });

    it('should toast success, close the panel, and reload on a successful create', () => {
      // arrange
      component.selectedTransaction.set(null);
      component.panelMode.set('create');
      mockTransactionApi.createTransaction.mockReturnValue(of(99));

      // act
      component.onSave({ request: formData as TransactionCreateRequest, tagIds: [] });

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Transaction created');
      expect(component.panelMode()).toBe('closed');
      expect(listLoads()).toHaveLength(2); // initial load + reload
    });

    it('should toast an error and leave the panel open when create fails', () => {
      // arrange
      component.selectedTransaction.set(null);
      component.panelMode.set('create');
      mockTransactionApi.createTransaction.mockReturnValue(
        throwError(() => ({ error: { detail: 'Invalid account' } })),
      );

      // act
      component.onSave({ request: formData as TransactionCreateRequest, tagIds: [] });

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Invalid account');
      expect(component.panelMode()).toBe('create');
    });
  });

  describe('onSave (PF-308: tag reconciliation)', () => {
    const newTagIds = (ids: number[]): TransactionFormSaveEvent => ({
      request: {
        accountId: 1,
        amount: 10,
        transactionDate: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        categoryId: 1,
        postDate: '',
        merchantId: 1,
      } as TransactionCreateRequest,
      tagIds: ids,
    });

    it('assigns every selected tag when creating a new transaction (no previous tags to diff against)', () => {
      // arrange -- createTransaction resolves to the new transaction's real generated id
      mockTransactionApi.createTransaction.mockReturnValue(of(99));

      // act
      component.onSave(newTagIds([5, 6]));

      // assert & verify
      expect(mockTagApi.assignToTransaction).toHaveBeenCalledWith(5, 99);
      expect(mockTagApi.assignToTransaction).toHaveBeenCalledWith(6, 99);
      expect(mockTagApi.removeFromTransaction).not.toHaveBeenCalled();
    });

    it(
      'bug regression: sends transactionDate as a midnight-UTC ISO datetime on create, not the ' +
        "form's raw yyyy-MM-dd value -- the backend's OffsetDateTime field can't deserialize a " +
        'bare date and rejected every create with a 400, live-verified end-to-end (PF-308 e2e)',
      () => {
        // arrange
        mockTransactionApi.createTransaction.mockReturnValue(of(99));

        // act
        component.onSave(newTagIds([]));

        // assert & verify
        expect(mockTransactionApi.createTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ transactionDate: '2026-03-01T00:00:00Z' }),
        );
      },
    );

    it('bug regression: sends transactionDate as a midnight-UTC ISO datetime on update too', () => {
      // arrange
      const existing = {
        id: 42,
        account: { id: 1, name: 'Checking' },
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: [],
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1));

      // act
      component.onSave({
        request: {
          id: 42,
          accountId: 1,
          amount: 10,
          transactionDate: '2026-03-01',
          description: '',
          type: 'EXPENSE',
          categoryId: 1,
          postDate: '',
          merchantId: 1,
        } as TransactionUpdateRequest,
        tagIds: [],
      });

      // assert & verify
      expect(mockTransactionApi.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ transactionDate: '2026-03-01T00:00:00Z' }),
      );
    });

    it(
      'bug regression: sends accountId on update -- TransactionUpdateRequest requires it ' +
        '(@NotNull server-side) but the update payload previously omitted it entirely, rejecting ' +
        'every edit with a 400, live-verified end-to-end (PF-308 e2e)',
      () => {
        // arrange
        const existing = {
          id: 42,
          account: { id: 1, name: 'Checking' },
          category: null,
          amount: 10,
          date: '2026-03-01',
          description: '',
          type: 'EXPENSE',
          merchant: null,
          tags: [],
        } as unknown as Transaction;
        component.selectedTransaction.set(existing);
        mockTransactionApi.updateTransaction.mockReturnValue(of(1));

        // act
        component.onSave({
          request: {
            id: 42,
            accountId: 7,
            amount: 10,
            transactionDate: '2026-03-01',
            description: '',
            type: 'EXPENSE',
            categoryId: 1,
            postDate: '',
            merchantId: 1,
          } as TransactionUpdateRequest,
          tagIds: [],
        });

        // assert & verify
        expect(mockTransactionApi.updateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ accountId: 7 }),
        );
      },
    );

    it('assigns newly-added tags and removes newly-unselected tags when editing an existing transaction', () => {
      // arrange -- transaction previously had tags 1 and 2; the user's new selection is 2 and 3
      const existing = {
        id: 42,
        account: { id: 1, name: 'Checking' },
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: [
          { id: 1, userId: 1, name: 'Old', color: null },
          { id: 2, userId: 1, name: 'Keep', color: null },
        ],
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1)); // rows-affected, not the transaction's own id

      const event: TransactionFormSaveEvent = {
        request: {
          id: 42,
          accountId: 1,
          amount: 10,
          transactionDate: '2026-03-01',
          description: '',
          type: 'EXPENSE',
          categoryId: 1,
          postDate: '',
          merchantId: 1,
        } as TransactionUpdateRequest,
        tagIds: [2, 3],
      };

      // act
      component.onSave(event);

      // assert & verify -- updateTransaction's return value (1) must NOT be used as the
      // transaction id; existing.id (42) must be, since update resolves to a row count
      expect(mockTagApi.assignToTransaction).toHaveBeenCalledWith(3, 42);
      expect(mockTagApi.assignToTransaction).not.toHaveBeenCalledWith(2, 42); // already assigned, not re-sent
      expect(mockTagApi.removeFromTransaction).toHaveBeenCalledWith(1, 42);
      expect(mockTagApi.removeFromTransaction).not.toHaveBeenCalledWith(2, 42); // still selected, not removed
    });

    it('calls neither assign nor remove when the tag selection is unchanged', () => {
      // arrange
      const existing = {
        id: 42,
        account: { id: 1, name: 'Checking' },
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: [{ id: 1, userId: 1, name: 'Same', color: null }],
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1));

      const event: TransactionFormSaveEvent = {
        request: {
          id: 42,
          accountId: 1,
          amount: 10,
          transactionDate: '2026-03-01',
          description: '',
          type: 'EXPENSE',
          categoryId: 1,
          postDate: '',
          merchantId: 1,
        } as TransactionUpdateRequest,
        tagIds: [1],
      };

      // act
      component.onSave(event);

      // assert & verify
      expect(mockTagApi.assignToTransaction).not.toHaveBeenCalled();
      expect(mockTagApi.removeFromTransaction).not.toHaveBeenCalled();
    });
  });

  describe('floating bulk bar', () => {
    const row = (id: number): Transaction =>
      ({
        id,
        account: { id: 1, name: 'Checking' },
        category: { id: 5, name: 'Groceries' },
        amount: 10,
        date: '2026-01-15T00:00:00Z',
        description: 'test',
        type: 'EXPENSE',
        merchant: { id: 7, name: 'Test' },
        tags: [],
      }) as unknown as Transaction;

    beforeEach(() => {
      component.transactions.set([row(1), row(2)]);
      fixture.detectChanges();
    });

    const bar = (): HTMLElement | null =>
      fixture.nativeElement.querySelector('app-transaction-bulk-bar [role="region"]');

    it('should be hidden when nothing is selected', () => {
      // act
      component.onSelectionChange([]);
      fixture.detectChanges();

      // assert & verify
      expect(bar()).toBeNull();
    });

    it('should appear with the selection count once rows are selected', () => {
      // act
      component.onSelectionChange([1, 2]);
      fixture.detectChanges();

      // assert & verify
      expect(bar()?.textContent).toContain('2 selected');
    });
  });

  describe('onBulkSave (PF-395)', () => {
    const buildTxn = (id: number): Transaction =>
      ({
        id,
        account: { id: 1 } as Transaction['account'],
        category: { id: 5 } as Transaction['category'],
        amount: 42.5,
        date: '2026-01-15T00:00:00Z',
        description: 'Original description',
        type: 'EXPENSE',
        merchant: { id: 7 } as Transaction['merchant'],
        tags: [],
      }) as unknown as Transaction;

    const noop: BulkEditData = {
      updateCategory: false,
      updateMerchant: false,
      updateDescription: false,
    };

    beforeEach(() => {
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(1));
    });

    it('should override only the category, keeping merchant/description/everything else from the transaction itself', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10)]);
      const newCategory = { id: 99 } as Category;

      // act
      component.onBulkSave({ ...noop, updateCategory: true, category: newCategory });

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 10,
          accountId: 1,
          amount: 42.5,
          transactionDate: '2026-01-15T00:00:00Z',
          categoryId: 99,
          merchantId: 7,
          description: 'Original description',
          type: 'EXPENSE',
        }),
      ]);
    });

    it('should override only the merchant', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10)]);
      const newMerchant = { id: 88 } as Merchant;

      // act
      component.onBulkSave({ ...noop, updateMerchant: true, merchant: newMerchant });

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 10,
          categoryId: 5,
          merchantId: 88,
          description: 'Original description',
        }),
      ]);
    });

    it('should override only the description', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10)]);

      // act
      component.onBulkSave({ ...noop, updateDescription: true, description: 'Corrected memo' });

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 10,
          categoryId: 5,
          merchantId: 7,
          description: 'Corrected memo',
        }),
      ]);
    });

    it('should override all three at once, and build one request per selected transaction', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10), buildTxn(11)]);
      const newCategory = { id: 99 } as Category;
      const newMerchant = { id: 88 } as Merchant;

      // act
      component.onBulkSave({
        updateCategory: true,
        category: newCategory,
        updateMerchant: true,
        merchant: newMerchant,
        updateDescription: true,
        description: 'Corrected memo',
      });

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 10,
          categoryId: 99,
          merchantId: 88,
          description: 'Corrected memo',
        }),
        expect.objectContaining({
          id: 11,
          categoryId: 99,
          merchantId: 88,
          description: 'Corrected memo',
        }),
      ]);
    });

    it('should toast success, close the panel, clear the selection, and reload on success', () => {
      // arrange
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(2));
      component.selectedTransactions.set([buildTxn(10), buildTxn(11)]);
      component.panelMode.set('bulk');

      // act
      component.onBulkSave({ ...noop, updateDescription: true, description: 'Corrected memo' });

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Updated 2 transactions');
      expect(component.panelMode()).toBe('closed');
      expect(component.selectedTransactions()).toEqual([]);
      expect(listLoads()).toHaveLength(2); // initial load + post-save reload
      expect(component.bulkSaving()).toBe(false);
    });

    it('should singularize the success toast for exactly one transaction', () => {
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(1));
      component.selectedTransactions.set([buildTxn(10)]);

      component.onBulkSave({ ...noop, updateDescription: true, description: 'Corrected memo' });

      expect(mockToast.success).toHaveBeenCalledWith('Updated 1 transaction');
    });

    it('should toast an error and keep the panel open on failure', () => {
      // arrange
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(
        throwError(() => ({ error: { detail: 'One or more transactions could not be updated' } })),
      );
      component.selectedTransactions.set([buildTxn(10)]);
      component.panelMode.set('bulk');

      // act
      component.onBulkSave({ ...noop, updateDescription: true, description: 'Corrected memo' });

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('One or more transactions could not be updated');
      expect(component.panelMode()).toBe('bulk');
      expect(component.bulkSaving()).toBe(false);
    });

    it('should fall back to a generic error message when the API error has no detail', () => {
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(throwError(() => ({ error: {} })));
      component.selectedTransactions.set([buildTxn(10)]);

      component.onBulkSave({ ...noop, updateDescription: true, description: 'Corrected memo' });

      expect(mockToast.error).toHaveBeenCalledWith('Bulk update failed');
    });
  });

  describe('deleteTransaction', () => {
    const txnToDelete = { id: 1, description: 'Coffee', amount: 5 } as Transaction;
    const remainingTxn = { id: 2, description: 'Groceries', amount: 50 } as Transaction;

    beforeEach(() => {
      // auto-accept the confirmation dialog, matching AccountsComponent's spec pattern
      mockConfirmationService.confirm.mockImplementation((config: Confirmation) => {
        if (config.accept) {
          config.accept();
        }
      });
    });

    it('should remove the deleted transaction from the transactions signal after reload', () => {
      // arrange -- the post-delete reload returns the list without the deleted transaction
      mockTransactionApi.deleteTransaction.mockReturnValue(of(undefined));
      mockTransactionApi.getTransactions.mockReturnValue(
        of({
          content: [remainingTxn],
          page: { totalElements: 1, totalPages: 1, number: 0, size: 20 },
        }),
      );

      // act
      component.deleteTransaction(txnToDelete);

      // assert & verify
      expect(mockTransactionApi.deleteTransaction).toHaveBeenCalledWith(txnToDelete.id);
      expect(listLoads()).toHaveLength(2); // initial load + post-delete reload
      expect(component.transactions()).toEqual([remainingTxn]);
      expect(component.transactions().some((t) => t.id === txnToDelete.id)).toBe(false);
    });

    it('should show a success toast and not alter the signal on successful delete with an empty result', () => {
      // arrange
      mockTransactionApi.deleteTransaction.mockReturnValue(of(undefined));
      mockTransactionApi.getTransactions.mockReturnValue(
        of({
          content: [],
          page: { totalElements: 0, totalPages: 0, number: 0, size: 20 },
        }),
      );

      // act
      component.deleteTransaction(txnToDelete);

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Transaction deleted');
      expect(component.transactions()).toEqual([]);
    });

    it('should show an error toast and leave the signal unchanged when delete fails', () => {
      // arrange -- component.transactions() starts as [] from the initial mocked load
      mockTransactionApi.deleteTransaction.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      // act
      component.deleteTransaction(txnToDelete);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to delete transaction.');
      expect(listLoads()).toHaveLength(1); // no reload attempted
      expect(component.transactions()).toEqual([]);
    });
  });

  describe('onMarkAsTransfer (PF-831)', () => {
    it('should mark every selected transaction as a transfer and reload', () => {
      // arrange
      const t1 = { id: 1, description: 'Payment to Card', amount: 500 } as Transaction;
      const t2 = { id: 2, description: 'Payment Received', amount: 500 } as Transaction;
      component.selectedTransactions.set([t1, t2]);
      mockTransactionApi.markAsTransfer.mockReturnValue(of(undefined));

      // act
      component.onMarkAsTransfer();

      // assert & verify
      expect(mockTransactionApi.markAsTransfer).toHaveBeenCalledWith([1, 2]);
      expect(mockToast.success).toHaveBeenCalledWith('2 transactions marked as transfer');
      expect(component.selectedTransactions()).toEqual([]);
      expect(listLoads()).toHaveLength(2); // initial load + post-mark reload
    });

    it('should do nothing when no transactions are selected', () => {
      // arrange
      component.selectedTransactions.set([]);

      // act
      component.onMarkAsTransfer();

      // assert & verify
      expect(mockTransactionApi.markAsTransfer).not.toHaveBeenCalled();
    });

    it('should show an error toast and leave the selection unchanged on failure', () => {
      // arrange
      const t1 = { id: 1, description: 'Payment', amount: 500 } as Transaction;
      component.selectedTransactions.set([t1]);
      mockTransactionApi.markAsTransfer.mockReturnValue(
        throwError(() => ({ error: { detail: 'Conflict' } })),
      );

      // act
      component.onMarkAsTransfer();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Conflict');
      expect(component.selectedTransactions()).toEqual([t1]);
    });
  });

  describe('onUnmarkAsTransfer (PF-831)', () => {
    it('should unmark every selected transaction as a transfer and reload', () => {
      // arrange
      const t1 = { id: 1, description: 'Payment to Card', amount: 500 } as Transaction;
      const t2 = { id: 2, description: 'Payment Received', amount: 500 } as Transaction;
      component.selectedTransactions.set([t1, t2]);
      mockTransactionApi.unmarkAsTransfer.mockReturnValue(of(undefined));

      // act
      component.onUnmarkAsTransfer();

      // assert & verify
      expect(mockTransactionApi.unmarkAsTransfer).toHaveBeenCalledWith([1, 2]);
      expect(mockToast.success).toHaveBeenCalledWith('2 transactions unmarked as transfer');
      expect(component.selectedTransactions()).toEqual([]);
      expect(listLoads()).toHaveLength(2); // initial load + post-unmark reload
    });

    it('should do nothing when no transactions are selected', () => {
      // arrange
      component.selectedTransactions.set([]);

      // act
      component.onUnmarkAsTransfer();

      // assert & verify
      expect(mockTransactionApi.unmarkAsTransfer).not.toHaveBeenCalled();
    });

    it('should show an error toast and leave the selection unchanged on failure', () => {
      // arrange
      const t1 = { id: 1, description: 'Payment', amount: 500 } as Transaction;
      component.selectedTransactions.set([t1]);
      mockTransactionApi.unmarkAsTransfer.mockReturnValue(
        throwError(() => ({ error: { detail: 'Conflict' } })),
      );

      // act
      component.onUnmarkAsTransfer();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Conflict');
      expect(component.selectedTransactions()).toEqual([t1]);
    });
  });

  describe('handleActionParam / review-transfers (PF-831)', () => {
    // The Dashboard's TRANSFER_REVIEW action item links here with ?action=review-transfers,
    // previously a dead link -- TransactionUrlStateService's hydrateFromParams only ever read the
    // filter/sort/pagination params it owns and silently dropped anything else, including this
    // one. A fresh TestBed is used here (rather than the outer describe's shared one, which
    // always initializes with empty query params) specifically to exercise ngOnInit() with this
    // param already present in the initial snapshot, matching how a real navigation works.
    let localFixture: ComponentFixture<TransactionsComponent>;
    let localComponent: TransactionsComponent;
    let localRouter: Mocked<Pick<Router, 'navigate'>>;

    beforeEach(async () => {
      localRouter = { navigate: vi.fn() };
      const localRoute = {
        snapshot: { queryParams: { action: 'review-transfers', accountId: '5' } },
        queryParams: of({ action: 'review-transfers', accountId: '5' }),
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TransactionsComponent, NoopAnimationsModule],
        providers: [
          { provide: TransactionApiService, useValue: mockTransactionApi },
          { provide: AccountApiService, useValue: mockAccountApi },
          { provide: CategoryApiService, useValue: mockCategoryApi },
          { provide: MerchantApiService, useValue: mockMerchantApi },
          { provide: TagApiService, useValue: mockTagApi },
          { provide: ToastService, useValue: mockToast },
          { provide: ConfirmationService, useValue: mockConfirmationService },
          { provide: MessageService, useValue: {} },
          { provide: Router, useValue: localRouter },
          { provide: ActivatedRoute, useValue: localRoute },
        ],
      }).compileComponents();

      localFixture = TestBed.createComponent(TransactionsComponent);
      localComponent = localFixture.componentInstance;
      localFixture.detectChanges();
    });

    it('should open the transfer dialog on init when action=review-transfers is present', () => {
      expect(localComponent.showTransferDialog()).toBe(true);
    });

    it('should strip the action param off the URL, preserving the rest, so a refresh does not reopen it', () => {
      expect(localRouter.navigate).toHaveBeenCalledWith([], {
        queryParams: { accountId: '5' },
        replaceUrl: true,
      });
    });
  });

  describe('page behaviour after the redesign (PF-865)', () => {
    const row = (id: number, overrides: Partial<Transaction> = {}): Transaction =>
      ({
        id,
        account: { id: 1, name: 'Checking' },
        category: { id: 5, name: 'Groceries' },
        amount: 10,
        date: '2026-10-15T00:00:00Z',
        description: 'test',
        type: 'EXPENSE',
        merchant: { id: 7, name: 'Test' },
        tags: [],
        ...overrides,
      }) as unknown as Transaction;

    /** Re-creates the page as if it were opened at a URL with these query params. */
    const openAt = (
      queryParams: Params,
      content: Transaction[] = [],
      totalElements = content.length,
    ): void => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 17));
      mockActivatedRoute.snapshot.queryParams = queryParams;
      mockTransactionApi.getTransactions.mockReturnValue(
        of({ content, page: { totalElements, totalPages: 1, number: 0, size: 20 } }),
      );
      fixture = TestBed.createComponent(TransactionsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    };

    afterEach(() => vi.useRealTimers());

    describe('default period', () => {
      it('should default to This month when the URL carries no filter', () => {
        // act
        openAt({});

        // assert & verify
        expect(toLocalDateString(component.state().filter.startDate!)).toBe('2026-10-01');
        expect(toLocalDateString(component.state().filter.endDate!)).toBe('2026-10-31');
      });

      it('should show all time, and the Needs a category tab, for ?categoryName=null', () => {
        // act
        openAt({ categoryName: 'null' });

        // assert & verify
        expect(component.state().filter.startDate).toBeUndefined();
        expect(component.activeTab()).toBe('NEEDS_CATEGORY');
      });
    });

    describe('tabs and filters', () => {
      it('should apply the uncategorized filter from the tab and clear it again, back on page one', () => {
        // arrange
        openAt({});
        component.onPageChange({ first: 40, rows: 20 });

        // act
        component.onTabChange('NEEDS_CATEGORY');

        // assert & verify
        expect(component.state().filter.categoryName).toBe('null');
        expect(component.state().page).toBe(0);

        // act
        component.onTabChange('ALL');

        // assert & verify
        expect(component.state().filter.categoryName).toBeUndefined();
      });

      it('should return to page one when the filter, the sort or the page size changes', () => {
        // arrange
        openAt({});
        component.onPageChange({ first: 20, rows: 20 });
        expect(component.state().page).toBe(1);

        // act and assert & verify
        component.onFilterChange({ description: 'shell' });
        expect(component.state().page).toBe(0);

        component.onPageChange({ first: 20, rows: 20 });
        component.onSortChange('amount,desc');
        expect(component.state().page).toBe(0);
        expect(component.state().sort).toBe('amount,desc');
      });

      it('should load the review counts from the action items', () => {
        // arrange
        mockDashboardApi.getActionItems.mockReturnValue(
          of([
            { type: ActionType.UNCATEGORIZED, count: 2594, message: 'x' },
            { type: ActionType.TRANSFER_REVIEW, count: 96, message: 'y' },
          ]),
        );

        // act
        openAt({});

        // assert & verify
        expect(component.reviewCounts()).toEqual({ uncategorized: 2594, transfers: 96 });
      });

      it('should show zero counts, not an error, when the counts cannot be loaded', () => {
        // arrange
        mockDashboardApi.getActionItems.mockReturnValue(throwError(() => new Error('down')));

        // act
        openAt({});

        // assert & verify
        expect(component.reviewCounts()).toEqual({ uncategorized: 0, transfers: 0 });
      });
    });

    describe('selection and the side panel', () => {
      it('should clear the selection whenever a new page of results is loaded', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.onSelectionChange([1, 2]);
        expect(component.selectedIds()).toEqual([1, 2]);

        // act
        component.onSortChange('amount,desc');
        fixture.detectChanges();

        // assert & verify
        expect(component.selectedIds()).toEqual([]);
      });

      it('should only select rows of the loaded page', () => {
        // arrange
        openAt({}, [row(1), row(2)]);

        // act
        component.onSelectionChange([2, 999]);

        // assert & verify
        expect(component.selectedIds()).toEqual([2]);
      });

      it('should open bulk mode for two or more selected rows and single mode for one', () => {
        // arrange
        openAt({}, [row(1), row(2)]);

        // act
        component.onSelectionChange([1, 2]);
        component.onEditMore();

        // assert & verify
        expect(component.panelMode()).toBe('bulk');

        // act
        component.onSelectionChange([1]);
        component.onEditMore();

        // assert & verify
        expect(component.panelMode()).toBe('single');
        expect(component.selectedTransaction()?.id).toBe(1);
      });

      it('should close bulk mode when the selection is cleared', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.onSelectionChange([1, 2]);
        component.onEditMore();

        // act
        component.onSelectionChange([]);

        // assert & verify
        expect(component.panelMode()).toBe('closed');
      });

      it('should keep the panel open on the refreshed row after saving an edit', () => {
        // arrange
        openAt({}, [row(1, { description: 'OLD' })]);
        component.openEditDialog(row(1, { description: 'OLD' }));
        mockTransactionApi.updateTransaction.mockReturnValue(of(1));
        mockTransactionApi.getTransactions.mockReturnValue(
          of({
            content: [row(1, { description: 'NEW' })],
            page: { totalElements: 1, totalPages: 1, number: 0, size: 20 },
          }),
        );

        // act
        component.onSave({
          request: {
            id: 1,
            accountId: 1,
            amount: 10,
            transactionDate: '2026-10-15',
            description: 'NEW',
            type: 'EXPENSE',
            categoryId: 5,
          } as TransactionUpdateRequest,
          tagIds: [],
        });

        // assert & verify
        expect(component.panelMode()).toBe('single');
        expect(component.selectedTransaction()?.description).toBe('NEW');
      });

      it('should close the panel when the edited row is no longer on the page', () => {
        // arrange
        openAt({}, [row(1)]);
        component.openEditDialog(row(1));
        mockTransactionApi.getTransactions.mockReturnValue(
          of({ content: [], page: { totalElements: 0, totalPages: 0, number: 0, size: 20 } }),
        );

        // act
        component.loadTransactions();

        // assert & verify
        expect(component.panelMode()).toBe('closed');
      });
    });

    describe('bulk apply', () => {
      it('should name what changed on success and clear the selection', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.onSelectionChange([1, 2]);
        mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(2));

        // act
        component.onBulkSave({
          updateCategory: true,
          category: { id: 9, name: 'Fuel' } as Category,
          updateMerchant: false,
          updateDescription: false,
        });

        // assert & verify
        expect(mockToast.success).toHaveBeenCalledWith('Set category on 2 transactions');
        expect(component.selectedIds()).toEqual([]);
      });

      it('should keep the selection so the user can retry when the bulk update fails', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.onSelectionChange([1, 2]);
        mockTransactionApi.bulkUpdateTransactions.mockReturnValue(
          throwError(() => ({ error: { detail: 'boom' } })),
        );

        // act
        component.onBulkSave({
          updateCategory: true,
          category: { id: 9, name: 'Fuel' } as Category,
          updateMerchant: false,
          updateDescription: false,
        });

        // assert & verify
        expect(mockToast.error).toHaveBeenCalledWith('boom');
        expect(component.selectedIds()).toEqual([1, 2]);
        expect(mockToast.success).not.toHaveBeenCalled();
      });
    });

    describe('default period and the URL', () => {
      it('should keep All time across a refresh when the URL says period=all', () => {
        // act
        openAt({ page: '2', period: 'all' });

        // assert & verify
        expect(component.state().filter.startDate).toBeUndefined();
        expect(component.state().page).toBe(2);
      });

      it('should apply This month to a URL with only paging, such as an older bookmark', () => {
        // act
        openAt({ page: '2' });

        // assert & verify
        expect(component.state().filter.startDate).toBeDefined();
      });

      it('should apply This month again when the sidebar link navigates to a bare /transactions', () => {
        // arrange
        const queryParams = new BehaviorSubject<Params>({});
        mockActivatedRoute.queryParams = queryParams;
        openAt({});
        component.onFilterChange({});
        expect(component.state().filter.startDate).toBeUndefined();

        // act
        queryParams.next({});

        // assert & verify
        expect(component.state().filter.startDate).toBeDefined();
      });
    });

    describe('unsaved edits', () => {
      const dirtyEditForm = (): void => {
        fixture.detectChanges();
        const form = fixture.debugElement.query(By.directive(TransactionEditFormComponent))
          .componentInstance as TransactionEditFormComponent;
        form.form.markAsDirty();
      };

      it('should ask before switching rows while the form has unsaved changes', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.openEditDialog(row(1));
        dirtyEditForm();

        // act
        component.openEditDialog(row(2));

        // assert & verify -- nothing changes until the user agrees to discard
        expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(1);
        expect(component.selectedTransaction()?.id).toBe(1);

        // act
        mockConfirmationService.confirm.mock.calls[0][0].accept!();

        // assert & verify
        expect(component.selectedTransaction()?.id).toBe(2);
      });

      it('should switch rows without asking when the form is untouched', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.openEditDialog(row(1));
        fixture.detectChanges();

        // act
        component.openEditDialog(row(2));

        // assert & verify
        expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
        expect(component.selectedTransaction()?.id).toBe(2);
      });

      it('should not ask to discard once the edits have been saved', () => {
        // arrange
        openAt({}, [row(1)]);
        component.openEditDialog(row(1));
        dirtyEditForm();
        mockTransactionApi.updateTransaction.mockReturnValue(of(1));

        // act
        component.onSave({
          request: {
            id: 1,
            accountId: 1,
            amount: 10,
            transactionDate: '2026-10-15',
            description: 'test',
            type: 'EXPENSE',
            categoryId: 5,
          } as TransactionUpdateRequest,
          tagIds: [],
        });
        component.onPanelClose();

        // assert & verify
        expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
        expect(component.panelMode()).toBe('closed');
      });

      it('should ask before Edit more replaces a dirty single form with the bulk form', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        component.openEditDialog(row(1));
        dirtyEditForm();
        component.onSelectionChange([1, 2]);

        // act
        component.onEditMore();

        // assert & verify
        expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(1);
        expect(component.panelMode()).toBe('single');

        // act
        mockConfirmationService.confirm.mock.calls[0][0].accept!();

        // assert & verify
        expect(component.panelMode()).toBe('bulk');
      });
    });

    describe('floating bulk bar spacing', () => {
      it('should leave room under the list while rows are selected so the bar never hides the last row', () => {
        // arrange
        openAt({}, [row(1), row(2)]);
        const listColumn = (): HTMLElement =>
          fixture.nativeElement.querySelector('app-transaction-list').parentElement;
        expect(listColumn().className).not.toContain('pb-24');

        // act
        component.onSelectionChange([1]);
        fixture.detectChanges();

        // assert & verify
        expect(listColumn().className).toContain('pb-24');
      });
    });

    describe('bulk mode panel', () => {
      const openBulk = (rows: Transaction[]): void => {
        openAt({}, rows);
        component.onSelectionChange(rows.map((r) => r.id));
        component.onEditMore();
        fixture.detectChanges();
      };
      const panelButton = (name: RegExp): HTMLButtonElement | undefined =>
        Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('aside button')).find(
          (b) => name.test((b.textContent ?? '').trim()),
        );

      it('should hide the floating bar while a panel is open, so it never covers the panel footer', () => {
        // act
        openBulk([row(1), row(2)]);

        // assert & verify
        expect(component.panelMode()).toBe('bulk');
        expect(
          fixture.nativeElement.querySelector('app-transaction-bulk-bar [role="region"]'),
        ).toBeNull();
      });

      it('should offer Mark as transfer and Clear selection inside the bulk panel', () => {
        // arrange
        openBulk([row(1), row(2)]);
        mockTransactionApi.markAsTransfer.mockReturnValue(of(undefined));

        // act
        panelButton(/^Mark as transfer/)?.click();

        // assert & verify
        expect(mockTransactionApi.markAsTransfer).toHaveBeenCalledWith([1, 2]);

        // act
        openBulk([row(1), row(2)]);
        panelButton(/^Clear selection/)?.click();
        fixture.detectChanges();

        // assert & verify
        expect(component.selectedIds()).toEqual([]);
        expect(component.panelMode()).toBe('closed');
      });

      it('should offer Unmark as transfer when every selected row is a transfer', () => {
        // act
        openBulk([row(1, { type: 'TRANSFER' as never }), row(2, { type: 'TRANSFER' as never })]);

        // assert & verify
        expect(panelButton(/^Unmark as transfer/)).toBeTruthy();
        expect(panelButton(/^Mark as transfer/)).toBeUndefined();
      });

      it('should show the net total of the selection, ignoring transfers', () => {
        // act
        openBulk([
          row(1, { type: 'INCOME' as never, amount: 100 }),
          row(2, { type: 'EXPENSE' as never, amount: 30 }),
          row(3, { type: 'TRANSFER' as never, amount: 500 }),
        ]);

        // assert & verify
        expect(
          fixture.nativeElement.querySelector('[data-testid="selection-net"]').textContent,
        ).toContain('+$70.00');
      });
    });

    describe('paging while loading', () => {
      it('should disable the paginator while a new page is loading', () => {
        // arrange
        openAt({}, [row(1)]);
        const wrapper = (): HTMLElement =>
          fixture.nativeElement.querySelector('p-paginator').parentElement;

        // act
        component.loading.set(true);
        fixture.detectChanges();

        // assert & verify
        expect(wrapper().className).toContain('pointer-events-none');

        // act
        component.loading.set(false);
        fixture.detectChanges();

        // assert & verify
        expect(wrapper().className).not.toContain('pointer-events-none');
      });
    });

    describe('save button', () => {
      it('should keep Save enabled for an incomplete single form so the user can see what to fix', () => {
        // arrange -- an uncategorized transaction: the form requires a category
        openAt({}, [row(1, { category: null as never })]);
        component.openEditDialog(row(1, { category: null as never }));
        fixture.detectChanges();

        // assert & verify
        expect(component.panelValid()).toBe(true);
      });
    });

    describe('tabs', () => {
      it('should leave other filters alone when All is clicked while already on All', () => {
        // arrange
        openAt({});
        component.onFilterChange({ categoryName: 'Groceries' });

        // act
        component.onTabChange('ALL');

        // assert & verify
        expect(component.state().filter.categoryName).toBe('Groceries');
      });
    });

    describe('empty and loading states', () => {
      it('should explain, and offer Clear filters, when filters match nothing, keeping the bar and tabs', () => {
        // act
        openAt({ description: 'zzz' });

        // assert & verify
        const root: HTMLElement = fixture.nativeElement;
        expect(root.querySelector('app-transaction-filter-bar')).toBeTruthy();
        expect(root.querySelector('app-transaction-review-tabs')).toBeTruthy();
        expect(root.textContent).toContain('No transactions match these filters');
        expect(root.querySelector('[data-testid="empty-clear-filters"]')).toBeTruthy();
      });

      it('should say there are no transactions yet when nothing is applied and nothing exists', () => {
        // arrange -- no filters at all, so the default This month applies; clear it to All time
        openAt({});
        component.onFilterChange({});
        fixture.detectChanges();

        // assert & verify
        expect(fixture.nativeElement.textContent).toContain('No transactions yet');
      });

      // PF-867: the default This month is a date range, which is not a "filter" in the user's
      // mind. An empty result has to be told apart from "nothing exists", so the page asks once
      // for any transaction at all.
      describe('when only the period is applied (PF-867)', () => {
        const sampleTransaction = {
          id: 7,
          account: { id: 1, name: 'Checking' },
          category: null,
          amount: 10,
          date: '2026-03-01',
          description: 'March coffee',
          type: 'EXPENSE',
          merchant: null,
          tags: [],
        } as unknown as Transaction;

        const page = (
          content: Transaction[],
          totalElements: number,
        ): PageResponse<Transaction> => ({
          content,
          page: { totalElements, totalPages: 1, number: 0, size: 20 },
        });

        /** Opens the bare page; the API answers empty for any dated request, `anywhere` for the rest. */
        const openWithHistory = (anywhere: Transaction[]): void => {
          vi.useFakeTimers({ toFake: ['Date'] });
          vi.setSystemTime(new Date(2026, 9, 17));
          mockActivatedRoute.snapshot.queryParams = {};
          mockTransactionApi.getTransactions.mockImplementation((filter: TransactionFilter) =>
            of(filter.startDate ? page([], 0) : page(anywhere, anywhere.length)),
          );
          fixture = TestBed.createComponent(TransactionsComponent);
          component = fixture.componentInstance;
          fixture.detectChanges();
        };

        it('should show the "yet" state with Add and Import CSV for a user with no transactions at all', () => {
          // act
          openWithHistory([]);

          // assert & verify
          const root: HTMLElement = fixture.nativeElement;
          expect(root.textContent).toContain('No transactions yet');
          expect(root.textContent).toContain('Add transaction');
          expect(root.textContent).toContain('Import CSV');
          expect(root.textContent).not.toContain('match these filters');
          expect(root.querySelector('[data-testid="empty-clear-filters"]')).toBeNull();
        });

        it('should name the period and offer Show all time when older transactions exist', () => {
          // act
          openWithHistory([sampleTransaction]);

          // assert & verify
          const root: HTMLElement = fixture.nativeElement;
          expect(root.textContent).toContain('No transactions in October yet');
          expect(root.textContent).not.toContain('No transactions yet');
          expect(root.querySelector('[data-testid="empty-show-all-time"]')).toBeTruthy();
        });

        it('should widen to all time and list the older transactions when Show all time is clicked', () => {
          // arrange
          openWithHistory([sampleTransaction]);

          // act
          (
            fixture.nativeElement.querySelector(
              '[data-testid="empty-show-all-time"] button',
            ) as HTMLButtonElement
          ).click();
          fixture.detectChanges();

          // assert & verify
          expect(component.state().filter.startDate).toBeUndefined();
          expect(component.transactions()).toEqual([sampleTransaction]);
        });

        it('should ask for one transaction with no filters to find out', () => {
          // act
          openWithHistory([]);

          // assert & verify
          const calls = mockTransactionApi.getTransactions.mock.calls;
          expect(calls.some(([filter, paging]) => !filter.startDate && paging.size === 1)).toBe(
            true,
          );
        });

        it('should not make that extra request when another filter is applied', () => {
          // act
          openAt({ description: 'zzz' });

          // assert & verify
          expect(component.emptyKind()).toBe('filtered');
          expect(component.anyTransactionsExist()).toBeNull();
        });
      });

      it('should show the error state with retry when loading fails with nothing to show', () => {
        // arrange
        openAt({});
        mockTransactionApi.getTransactions.mockReturnValue(throwError(() => new Error('down')));

        // act
        component.loadTransactions();
        fixture.detectChanges();

        // assert & verify
        expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
      });
    });
  });
});
