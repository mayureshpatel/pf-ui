import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TransactionsComponent} from './transactions.component';
import {TransactionApiService} from './services/transaction-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {MerchantApiService} from '@features/merchants/services/merchant-api.service';
import {TagApiService} from '@features/tags/services/tag-api.service';
import {ToastService} from '@core/services/toast.service';
import {ConfirmationService, MessageService} from 'primeng/api';
import {ActivatedRoute, Router} from '@angular/router';
import {of, throwError} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {vi} from 'vitest';
import {Transaction, TransactionCreateRequest, TransactionFormSaveEvent, TransactionUpdateRequest} from '@models/transaction.model';
import {BulkEditData} from './components/bulk-edit-dialog/bulk-edit-dialog.component';
import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

describe('TransactionsComponent', () => {
  let component: TransactionsComponent;
  let fixture: ComponentFixture<TransactionsComponent>;
  let mockTransactionApi: any;
  let mockAccountApi: any;
  let mockCategoryApi: any;
  let mockMerchantApi: any;
  let mockTagApi: any;
  let mockToast: any;
  let mockConfirmationService: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockTransactionApi = {
      getTransactions: vi.fn().mockReturnValue(of({
        content: [],
        page: {totalElements: 0, totalPages: 0, number: 0, size: 20}
      })),
      deleteTransaction: vi.fn(),
      createTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      bulkUpdateTransactions: vi.fn()
    };
    mockAccountApi = {
      getAccounts: vi.fn().mockReturnValue(of([]))
    };
    mockCategoryApi = {
      getCategories: vi.fn().mockReturnValue(of([])),
      getCategoriesWithTransactions: vi.fn().mockReturnValue(of([])),
      getMerchantsWithTransactions: vi.fn().mockReturnValue(of([])),
      getGroupedCategories: vi.fn().mockReturnValue(of([])) // consumed by the child BulkEditDialogComponent
    };
    mockMerchantApi = {
      getMerchants: vi.fn().mockReturnValue(of([]))
    };
    mockTagApi = {
      getTags: vi.fn().mockReturnValue(of([])),
      assignToTransaction: vi.fn().mockReturnValue(of(undefined)),
      removeFromTransaction: vi.fn().mockReturnValue(of(undefined))
    };
    mockToast = {
      success: vi.fn(),
      error: vi.fn()
    };
    mockConfirmationService = {
      confirm: vi.fn()
    };
    mockRouter = {
      navigate: vi.fn()
    };
    mockActivatedRoute = {
      snapshot: {queryParams: {}},
      queryParams: of({})
    };

    await TestBed.configureTestingModule({
      imports: [TransactionsComponent, NoopAnimationsModule],
      providers: [
        {provide: TransactionApiService, useValue: mockTransactionApi},
        {provide: AccountApiService, useValue: mockAccountApi},
        {provide: CategoryApiService, useValue: mockCategoryApi},
        {provide: MerchantApiService, useValue: mockMerchantApi},
        {provide: TagApiService, useValue: mockTagApi},
        {provide: ToastService, useValue: mockToast},
        {provide: ConfirmationService, useValue: mockConfirmationService},
        {provide: MessageService, useValue: {}},
        {provide: Router, useValue: mockRouter},
        {provide: ActivatedRoute, useValue: mockActivatedRoute}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Clear Filters button an accessible name (PF-186)', () => {
    // arrange -- the table (and its Clear button) only renders when !isEmpty(); set the
    // signal directly since the initial fetch already resolved (empty) in beforeEach
    component.transactions.set([{
      id: 1,
      account: {name: 'Checking'},
      category: null,
      amount: -10,
      date: new Date('2026-01-15'),
      description: 'test',
      type: 'EXPENSE',
      merchant: {originalName: 'Test'}
    } as unknown as Transaction]);

    // act
    fixture.detectChanges();

    // assert & verify -- already has a visible "Clear" label, but "Clear Filters" is
    // the clearer, more specific accessible name (matches the pTooltip text)
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-filter-slash)');
    expect(button.getAttribute('aria-label')).toBe('Clear Filters');
  });

  it('should handle onLazyLoad with dateIs filter', () => {
    // arrange
    const testDate = new Date('2026-03-12');
    const event = {
      first: 0,
      rows: 20,
      sortField: 'date',
      sortOrder: -1,
      filters: {
        date: {value: testDate, matchMode: 'dateIs'}
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.startDate?.getTime()).toBe(testDate.getTime());
    expect(state.filter.endDate?.getTime()).toBe(testDate.getTime());
    expect(mockTransactionApi.getTransactions).toHaveBeenCalled();
  });

  it('should handle onLazyLoad with dateAfter and dateBefore filters', () => {
    // arrange
    const startDate = new Date('2026-03-01');
    const endDate = new Date('2026-03-31');
    const event = {
      first: 0,
      rows: 20,
      filters: {
        date: [
          {value: startDate, matchMode: 'dateAfter'},
          {value: endDate, matchMode: 'dateBefore'}
        ]
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.startDate?.getTime()).toBe(startDate.getTime());
    expect(state.filter.endDate?.getTime()).toBe(endDate.getTime());
  });

  it('should clear date filters when cleared in UI', () => {
    // arrange
    component.state.set({
      filter: {startDate: new Date()},
      page: 0,
      size: 20,
      sort: 'date,desc'
    });
    const event = {
      first: 0,
      rows: 20,
      filters: {}
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.startDate).toBeUndefined();
    expect(state.filter.endDate).toBeUndefined();
  });

  it('should handle onLazyLoad with merchant and description filters', () => {
    // arrange
    const event = {
      first: 0,
      rows: 20,
      filters: {
        merchantAndDesc: [{
          value: { merchant: 'Amazon', description: 'cloud' },
          matchMode: 'custom'
        }]
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.merchant).toBe('Amazon');
    expect(state.filter.description).toBe('cloud');
  });

  it('PF-308: should handle onLazyLoad with a tag filter', () => {
    // arrange
    const event = {
      first: 0,
      rows: 20,
      filters: {
        tagId: {value: 7, matchMode: 'equals'}
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.tagId).toBe(7);
  });

  it('PF-308: should clear the tag filter when cleared in UI', () => {
    // arrange
    component.state.set({
      filter: {tagId: 7},
      page: 0,
      size: 20,
      sort: 'date,desc'
    });
    const event = {first: 0, rows: 20, filters: {}};

    // act
    component.onLazyLoad(event);

    // assert & verify
    expect(component.state().filter.tagId).toBeUndefined();
  });

  describe('onSave (PF-308: tag reconciliation)', () => {
    const newTagIds = (ids: number[]): TransactionFormSaveEvent => ({
      request: {accountId: 1, amount: 10, transactionDate: '2026-03-01', description: '', type: 'EXPENSE', categoryId: 1, postDate: '', merchantId: 1} as TransactionCreateRequest,
      tagIds: ids
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

    it("bug regression: sends transactionDate as a midnight-UTC ISO datetime on create, not the "
        + "form's raw yyyy-MM-dd value -- the backend's OffsetDateTime field can't deserialize a "
        + "bare date and rejected every create with a 400, live-verified end-to-end (PF-308 e2e)", () => {
      // arrange
      mockTransactionApi.createTransaction.mockReturnValue(of(99));

      // act
      component.onSave(newTagIds([]));

      // assert & verify
      expect(mockTransactionApi.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({transactionDate: '2026-03-01T00:00:00Z'})
      );
    });

    it('bug regression: sends transactionDate as a midnight-UTC ISO datetime on update too', () => {
      // arrange
      const existing = {
        id: 42,
        account: {id: 1, name: 'Checking'},
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: []
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1));

      // act
      component.onSave({
        request: {id: 42, accountId: 1, amount: 10, transactionDate: '2026-03-01', description: '', type: 'EXPENSE', categoryId: 1, postDate: '', merchantId: 1} as TransactionUpdateRequest,
        tagIds: []
      });

      // assert & verify
      expect(mockTransactionApi.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({transactionDate: '2026-03-01T00:00:00Z'})
      );
    });

    it("bug regression: sends accountId on update -- TransactionUpdateRequest requires it "
        + "(@NotNull server-side) but the update payload previously omitted it entirely, rejecting "
        + "every edit with a 400, live-verified end-to-end (PF-308 e2e)", () => {
      // arrange
      const existing = {
        id: 42,
        account: {id: 1, name: 'Checking'},
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: []
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1));

      // act
      component.onSave({
        request: {id: 42, accountId: 7, amount: 10, transactionDate: '2026-03-01', description: '', type: 'EXPENSE', categoryId: 1, postDate: '', merchantId: 1} as TransactionUpdateRequest,
        tagIds: []
      });

      // assert & verify
      expect(mockTransactionApi.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({accountId: 7})
      );
    });

    it('assigns newly-added tags and removes newly-unselected tags when editing an existing transaction', () => {
      // arrange -- transaction previously had tags 1 and 2; the user's new selection is 2 and 3
      const existing = {
        id: 42,
        account: {id: 1, name: 'Checking'},
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: [{id: 1, userId: 1, name: 'Old', color: null}, {id: 2, userId: 1, name: 'Keep', color: null}]
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1)); // rows-affected, not the transaction's own id

      const event: TransactionFormSaveEvent = {
        request: {id: 42, accountId: 1, amount: 10, transactionDate: '2026-03-01', description: '', type: 'EXPENSE', categoryId: 1, postDate: '', merchantId: 1} as TransactionUpdateRequest,
        tagIds: [2, 3]
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
        account: {id: 1, name: 'Checking'},
        category: null,
        amount: 10,
        date: '2026-03-01',
        description: '',
        type: 'EXPENSE',
        merchant: null,
        tags: [{id: 1, userId: 1, name: 'Same', color: null}]
      } as unknown as Transaction;
      component.selectedTransaction.set(existing);
      mockTransactionApi.updateTransaction.mockReturnValue(of(1));

      const event: TransactionFormSaveEvent = {
        request: {id: 42, accountId: 1, amount: 10, transactionDate: '2026-03-01', description: '', type: 'EXPENSE', categoryId: 1, postDate: '', merchantId: 1} as TransactionUpdateRequest,
        tagIds: [1]
      };

      // act
      component.onSave(event);

      // assert & verify
      expect(mockTagApi.assignToTransaction).not.toHaveBeenCalled();
      expect(mockTagApi.removeFromTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Bulk Edit trigger visibility (PF-395)', () => {
    beforeEach(() => {
      // the toolbar (and its trigger buttons) only renders when !isEmpty(); a real table row
      // needs the nested account/category/merchant fields a bare {id} fixture doesn't have
      component.transactions.set([{
        id: 1,
        account: {name: 'Checking'},
        category: null,
        amount: -10,
        date: new Date('2026-01-15'),
        description: 'test',
        type: 'EXPENSE',
        merchant: {originalName: 'Test'}
      } as unknown as Transaction]);
    });

    // Scoped by label text, not just the pi-pencil icon class -- the table's own per-row edit
    // action button also uses a pencil icon, and would otherwise false-match this selector.
    const findBulkEditButton = (): HTMLButtonElement | undefined =>
      (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
        .find((b: HTMLButtonElement): boolean => !!b.textContent?.includes('Bulk Edit'));

    it('should be hidden when nothing is selected', () => {
      component.selectedTransactions.set([]);
      fixture.detectChanges();

      expect(findBulkEditButton()).toBeUndefined();
    });

    it('should appear, showing the selection count, once at least one row is selected', () => {
      component.selectedTransactions.set([{id: 1} as Transaction, {id: 2} as Transaction]);
      fixture.detectChanges();

      const button = findBulkEditButton();
      expect(button).not.toBeUndefined();
      expect(button!.textContent).toContain('Bulk Edit (2)');
    });
  });

  describe('onBulkSave (PF-395)', () => {
    const buildTxn = (id: number): Transaction => ({
      id,
      account: {id: 1} as Transaction['account'],
      category: {id: 5} as Transaction['category'],
      amount: 42.5,
      date: '2026-01-15T00:00:00Z',
      description: 'Original description',
      type: 'EXPENSE',
      merchant: {id: 7} as Transaction['merchant'],
      tags: []
    }) as unknown as Transaction;

    const noop: BulkEditData = {updateCategory: false, updateMerchant: false, updateDescription: false};

    beforeEach(() => {
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(1));
    });

    it('should override only the category, keeping merchant/description/everything else from the transaction itself', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10)]);
      const newCategory = {id: 99} as Category;

      // act
      component.onBulkSave({...noop, updateCategory: true, category: newCategory});

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 10, accountId: 1, amount: 42.5, transactionDate: '2026-01-15T00:00:00Z',
          categoryId: 99, merchantId: 7, description: 'Original description', type: 'EXPENSE'
        })
      ]);
    });

    it('should override only the merchant', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10)]);
      const newMerchant = {id: 88} as Merchant;

      // act
      component.onBulkSave({...noop, updateMerchant: true, merchant: newMerchant});

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({id: 10, categoryId: 5, merchantId: 88, description: 'Original description'})
      ]);
    });

    it('should override only the description', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10)]);

      // act
      component.onBulkSave({...noop, updateDescription: true, description: 'Corrected memo'});

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({id: 10, categoryId: 5, merchantId: 7, description: 'Corrected memo'})
      ]);
    });

    it('should override all three at once, and build one request per selected transaction', () => {
      // arrange
      component.selectedTransactions.set([buildTxn(10), buildTxn(11)]);
      const newCategory = {id: 99} as Category;
      const newMerchant = {id: 88} as Merchant;

      // act
      component.onBulkSave({
        updateCategory: true, category: newCategory,
        updateMerchant: true, merchant: newMerchant,
        updateDescription: true, description: 'Corrected memo'
      });

      // assert & verify
      expect(mockTransactionApi.bulkUpdateTransactions).toHaveBeenCalledWith([
        expect.objectContaining({id: 10, categoryId: 99, merchantId: 88, description: 'Corrected memo'}),
        expect.objectContaining({id: 11, categoryId: 99, merchantId: 88, description: 'Corrected memo'})
      ]);
    });

    it('should toast success, close the dialog, clear the selection, and reload on success', () => {
      // arrange
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(2));
      component.selectedTransactions.set([buildTxn(10), buildTxn(11)]);
      component.showBulkEditDialog.set(true);

      // act
      component.onBulkSave({...noop, updateDescription: true, description: 'Corrected memo'});

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('2 transactions updated');
      expect(component.showBulkEditDialog()).toBe(false);
      expect(component.selectedTransactions()).toEqual([]);
      expect(mockTransactionApi.getTransactions).toHaveBeenCalledTimes(2); // initial load + post-save reload
      expect(component.bulkSaving()).toBe(false);
    });

    it('should singularize the success toast for exactly one transaction', () => {
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(of(1));
      component.selectedTransactions.set([buildTxn(10)]);

      component.onBulkSave({...noop, updateDescription: true, description: 'Corrected memo'});

      expect(mockToast.success).toHaveBeenCalledWith('1 transaction updated');
    });

    it('should toast an error and keep the dialog open on failure', () => {
      // arrange
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(
        throwError(() => ({error: {detail: 'One or more transactions could not be updated'}}))
      );
      component.selectedTransactions.set([buildTxn(10)]);
      component.showBulkEditDialog.set(true);

      // act
      component.onBulkSave({...noop, updateDescription: true, description: 'Corrected memo'});

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('One or more transactions could not be updated');
      expect(component.showBulkEditDialog()).toBe(true);
      expect(component.bulkSaving()).toBe(false);
    });

    it('should fall back to a generic error message when the API error has no detail', () => {
      mockTransactionApi.bulkUpdateTransactions.mockReturnValue(throwError(() => ({error: {}})));
      component.selectedTransactions.set([buildTxn(10)]);

      component.onBulkSave({...noop, updateDescription: true, description: 'Corrected memo'});

      expect(mockToast.error).toHaveBeenCalledWith('Bulk update failed');
    });
  });

  describe('deleteTransaction', () => {
    const txnToDelete = {id: 1, description: 'Coffee', amount: 5} as Transaction;
    const remainingTxn = {id: 2, description: 'Groceries', amount: 50} as Transaction;

    beforeEach(() => {
      // auto-accept the confirmation dialog, matching AccountsComponent's spec pattern
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        if (config.accept) {
          config.accept();
        }
        return mockConfirmationService;
      });
    });

    it('should remove the deleted transaction from the transactions signal after reload', () => {
      // arrange -- the post-delete reload returns the list without the deleted transaction
      mockTransactionApi.deleteTransaction.mockReturnValue(of(undefined));
      mockTransactionApi.getTransactions.mockReturnValue(of({
        content: [remainingTxn],
        page: {totalElements: 1, totalPages: 1, number: 0, size: 20}
      }));

      // act
      component.deleteTransaction(txnToDelete);

      // assert & verify
      expect(mockTransactionApi.deleteTransaction).toHaveBeenCalledWith(txnToDelete.id);
      expect(mockTransactionApi.getTransactions).toHaveBeenCalledTimes(2); // initial load + post-delete reload
      expect(component.transactions()).toEqual([remainingTxn]);
      expect(component.transactions().some(t => t.id === txnToDelete.id)).toBe(false);
    });

    it('should show a success toast and not alter the signal on successful delete with an empty result', () => {
      // arrange
      mockTransactionApi.deleteTransaction.mockReturnValue(of(undefined));
      mockTransactionApi.getTransactions.mockReturnValue(of({
        content: [],
        page: {totalElements: 0, totalPages: 0, number: 0, size: 20}
      }));

      // act
      component.deleteTransaction(txnToDelete);

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Transaction deleted');
      expect(component.transactions()).toEqual([]);
    });

    it('should show an error toast and leave the signal unchanged when delete fails', () => {
      // arrange -- component.transactions() starts as [] from the initial mocked load
      mockTransactionApi.deleteTransaction.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      // act
      component.deleteTransaction(txnToDelete);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to delete transaction.');
      expect(mockTransactionApi.getTransactions).toHaveBeenCalledTimes(1); // no reload attempted
      expect(component.transactions()).toEqual([]);
    });
  });
});
