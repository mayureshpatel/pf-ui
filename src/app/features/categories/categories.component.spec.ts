import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';

import { CategoriesComponent } from './categories.component';
import { CategoryApiService } from './services/category-api.service';
import { CategoryEditFormComponent } from './components/category-edit-form/category-edit-form.component';
import { NO_FILTER } from './utils/category-helpers';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { Category, CategoryType } from '@models/category.model';

const cat = (
  id: number,
  name: string,
  parent: Category | null = null,
  type: CategoryType = CategoryType.EXPENSE,
): Category =>
  ({ id, userId: 1, name, type, parent, icon: 'pi-tag', color: '#3B82F6' }) as Category;

const food = cat(1, 'Food');
const groceries = cat(2, 'Groceries', food);
const dining = cat(3, 'Dining out', food);
const coffee = cat(4, 'Coffee', food);
const housing = cat(5, 'Housing');
const travel = cat(6, 'Travel');
const income = cat(7, 'Income', null, CategoryType.INCOME);
const paycheck = cat(8, 'Paycheck', income, CategoryType.INCOME);
const flat = [food, groceries, dining, coffee, housing, travel, income, paycheck];
const counts = [
  { ...groceries, transactionCount: 301 },
  { ...dining, transactionCount: 98 },
  { ...housing, transactionCount: 12 },
  { ...paycheck, transactionCount: 24 },
];

describe('CategoriesComponent', () => {
  let component: CategoriesComponent;
  let fixture: ComponentFixture<CategoriesComponent>;
  let mockCategoryApi: Mocked<
    Pick<
      CategoryApiService,
      'getCategories' | 'createCategory' | 'updateCategory' | 'deleteCategory'
    >
  >;
  let mockTransactionApi: Mocked<Pick<TransactionApiService, 'getCountsByCategory'>>;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmationService: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: Mocked<Pick<Router, 'navigate'>>;

  const confirmAccept = (index = 0): void =>
    mockConfirmationService.confirm.mock.calls[index][0].accept!();
  const openByName = (name: string): void =>
    component.openCategory(component.categories().find((c) => c.name === name)!);
  const dirtyForm = (): void => {
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(CategoryEditFormComponent))
      .componentInstance as CategoryEditFormComponent;
    form.form.markAsDirty();
  };
  const loadWith = (categories: Category[], withCounts: Category[] = counts): void => {
    mockCategoryApi.getCategories.mockReturnValue(of(categories));
    mockTransactionApi.getCountsByCategory.mockReturnValue(of(withCounts));
    component.loadData();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockCategoryApi = {
      getCategories: vi.fn().mockReturnValue(of(flat)),
      createCategory: vi.fn().mockReturnValue(of(99)),
      updateCategory: vi.fn().mockReturnValue(of(1)),
      deleteCategory: vi.fn().mockReturnValue(of(undefined)),
    };
    mockTransactionApi = { getCountsByCategory: vi.fn().mockReturnValue(of(counts)) };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CategoriesComponent, NoopAnimationsModule],
      providers: [
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: TransactionApiService, useValue: mockTransactionApi },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('loading', () => {
    it('should load categories and counts together and give each category its own count', () => {
      // assert & verify
      expect(component.categories().length).toBe(8);
      expect(component.categories().find((c) => c.name === 'Groceries')?.transactionCount).toBe(
        301,
      );
      expect(component.categories().find((c) => c.name === 'Travel')?.transactionCount).toBe(0);
      expect(component.loadedOnce()).toBe(true);
    });

    it('should clear the data, flag the error and show the error page when loading fails', () => {
      // arrange
      mockCategoryApi.getCategories.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadData();
      fixture.detectChanges();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load categories');
      expect(component.categories()).toEqual([]);
      expect(component.loadError()).toBe(true);
      expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
    });

    it('should drop a slower response from an earlier load', () => {
      // arrange
      const pending: Subject<Category[]>[] = [];
      mockCategoryApi.getCategories.mockImplementation(() => {
        const request = new Subject<Category[]>();
        pending.push(request);
        return request;
      });

      // act -- two loads, answered in reverse order
      component.loadData();
      component.loadData();
      pending[1].next([travel]);
      pending[1].complete();
      pending[0].next([food]);
      pending[0].complete();

      // assert & verify
      expect(component.categories().map((c) => c.name)).toEqual(['Travel']);
      expect(component.loading()).toBe(false);
    });
  });

  describe('modes and navigation', () => {
    it('should start in overview with the stats and nothing selected', () => {
      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.panelTitle()).toBe('Overview');
      expect(component.selectedCategoryId()).toBeNull();
      expect(component.stats()).toEqual({ categories: 8, groups: 4, transactions: 435, unused: 4 });
    });

    it('should open a category with its name as the title, and Back or Close return to overview', () => {
      // act
      openByName('Groceries');

      // assert & verify
      expect(component.panelMode()).toBe('category');
      expect(component.panelTitle()).toBe('Groceries');

      // act
      component.back();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedCategoryId()).toBeNull();

      // act
      openByName('Groceries');
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
    });

    it('should do nothing on Close or Escape in overview', () => {
      // act
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
    });

    it('should open add from the header with no parent, and from a parent with that parent', () => {
      // act
      component.startAdd();

      // assert & verify
      expect(component.panelMode()).toBe('add');
      expect(component.panelTitle()).toBe('Add category');
      expect(component.addParentId()).toBeNull();

      // act
      openByName('Food');
      component.startAdd(1);

      // assert & verify
      expect(component.addParentId()).toBe(1);
      expect(component.selectedCategoryId()).toBe(1);

      // act
      component.back();

      // assert & verify
      expect(component.panelMode()).toBe('category');
    });
  });

  describe('save, add and delete', () => {
    it('should update by id, toast, reload and stay on the category', () => {
      // arrange
      openByName('Travel');
      mockCategoryApi.getCategories.mockClear();

      // act
      component.saveCategory({ id: 6, name: 'Trips', type: 'EXPENSE' });

      // assert & verify
      expect(mockCategoryApi.updateCategory).toHaveBeenCalledWith(6, {
        id: 6,
        name: 'Trips',
        type: 'EXPENSE',
      });
      expect(mockToast.success).toHaveBeenCalledWith('Category updated');
      expect(mockCategoryApi.getCategories).toHaveBeenCalledTimes(1);
      expect(component.panelMode()).toBe('category');
    });

    it('should create, toast, open the new category, expand its parent and reload', () => {
      // arrange
      component.startAdd(1);
      mockCategoryApi.getCategories.mockReturnValue(of([...flat, cat(99, 'Snacks', food)]));

      // act
      component.saveCategory({ name: 'Snacks', type: 'EXPENSE', parentId: 1 });

      // assert & verify
      expect(mockCategoryApi.createCategory).toHaveBeenCalledWith({
        name: 'Snacks',
        type: 'EXPENSE',
        parentId: 1,
      });
      expect(mockToast.success).toHaveBeenCalledWith('Category added');
      expect(component.panelMode()).toBe('category');
      expect(component.selectedCategoryId()).toBe(99);
      expect(component.expandedIds().has(1)).toBe(true);
    });

    it('should toast the API message, or a fallback, and keep the form when saving fails', () => {
      // arrange
      openByName('Travel');
      mockCategoryApi.updateCategory.mockReturnValue(
        throwError(() => ({ error: { detail: 'Name taken' } })),
      );

      // act
      component.saveCategory({ id: 6, name: 'x', type: 'EXPENSE' });

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Name taken');
      expect(component.panelMode()).toBe('category');

      // arrange
      mockCategoryApi.updateCategory.mockReturnValue(throwError(() => ({})));

      // act
      component.saveCategory({ id: 6, name: 'x', type: 'EXPENSE' });

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to save category');
    });

    it('should explain why a category cannot be deleted', () => {
      // act and assert & verify
      openByName('Groceries');
      expect(component.deleteBlockedReason()).toBe('It has 301 transactions.');
      openByName('Food');
      expect(component.deleteBlockedReason()).toBe('Move or delete its subcategories first.');
      openByName('Travel');
      expect(component.deleteBlockedReason()).toBeNull();
    });

    it('should confirm by name, delete, toast, return to overview and reload', () => {
      // arrange
      openByName('Travel');
      mockCategoryApi.getCategories.mockClear();

      // act
      component.deleteCategory();

      // assert & verify
      expect(mockConfirmationService.confirm.mock.calls[0][0].message).toContain('Travel');
      expect(mockCategoryApi.deleteCategory).not.toHaveBeenCalled();

      // act
      confirmAccept();

      // assert & verify
      expect(mockCategoryApi.deleteCategory).toHaveBeenCalledWith(6);
      expect(mockToast.success).toHaveBeenCalledWith('Category deleted');
      expect(component.panelMode()).toBe('overview');
      expect(mockCategoryApi.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should never delete a blocked category', () => {
      // arrange
      openByName('Groceries');

      // act
      component.deleteCategory();

      // assert & verify
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });

    it("should toast the server's refusal and keep the category", () => {
      // arrange
      openByName('Travel');
      mockCategoryApi.deleteCategory.mockReturnValue(
        throwError(() => ({ error: { detail: "Category 'Travel' is used by a rule" } })),
      );

      // act
      component.deleteCategory();
      confirmAccept();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith("Category 'Travel' is used by a rule");
      expect(component.panelMode()).toBe('category');
    });

    it('should return to overview with a toast when the shown category is gone after a reload', () => {
      // arrange
      openByName('Travel');

      // act
      loadWith(flat.filter((c) => c.id !== 6));

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(mockToast.error).toHaveBeenCalledWith('That category no longer exists.');
    });

    it('should leave the add form open across a reload', () => {
      // arrange
      component.startAdd();

      // act
      loadWith(flat);

      // assert & verify
      expect(component.panelMode()).toBe('add');
    });

    it('should ignore save, add and delete while loading or saving', () => {
      // arrange
      openByName('Travel');
      component.loading.set(true);

      // act
      component.saveCategory({ id: 6, name: 'x', type: 'EXPENSE' });
      component.deleteCategory();

      // assert & verify
      expect(mockCategoryApi.updateCategory).not.toHaveBeenCalled();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();

      // arrange
      component.loading.set(false);
      mockCategoryApi.updateCategory.mockReturnValue(new Subject<number>());

      // act
      component.saveCategory({ id: 6, name: 'x', type: 'EXPENSE' });
      component.saveCategory({ id: 6, name: 'y', type: 'EXPENSE' });

      // assert & verify
      expect(mockCategoryApi.updateCategory).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(true);
    });
  });

  describe('filters', () => {
    it('should narrow the visible tree by type, Unused and search, and clear them', () => {
      // act
      component.setFilter({ ...NO_FILTER, search: 'coff' });

      // assert & verify
      expect(component.visibleNodes().map((n) => [n.parent.name, n.children.length])).toEqual([
        ['Food', 1],
      ]);

      // act
      component.setFilter({ ...NO_FILTER, type: CategoryType.INCOME });

      // assert & verify
      expect(component.visibleNodes().map((n) => n.parent.name)).toEqual(['Income']);

      // act
      component.clearFilters();

      // assert & verify
      expect(component.visibleNodes().length).toBe(4);
      expect(component.filtering()).toBe(false);
    });

    it('should show matching children expanded while filtering, and use its own state otherwise', () => {
      // act
      component.setFilter({ ...NO_FILTER, search: 'coff' });

      // assert & verify
      expect(component.expandedForTree().has(1)).toBe(true);

      // act
      component.clearFilters();

      // assert & verify
      expect(component.expandedForTree().has(1)).toBe(false);
      component.toggleExpand(1);
      expect(component.expandedForTree().has(1)).toBe(true);
      component.collapseAll();
      expect(component.expandedForTree().size).toBe(0);
      component.expandAll();
      expect(component.expandedForTree().has(1)).toBe(true);
      expect(component.expandedForTree().has(7)).toBe(true);
    });

    it('should turn on checkboxes with the Unused pill, open selection on a tick and return when the last is unticked', () => {
      // act
      component.setFilter({ ...NO_FILTER, unusedOnly: true });

      // assert & verify
      expect(component.showChecks()).toBe(true);
      expect([...component.tickableIds()].sort()).toEqual([4, 6]);

      // act
      component.toggleTick(6);

      // assert & verify
      expect(component.panelMode()).toBe('selection');
      expect(component.panelTitle()).toBe('1 selected');

      // act
      component.toggleTick(6);

      // assert & verify
      expect(component.panelMode()).toBe('overview');
    });

    it('should clear the ticks when Unused is turned off, and drop ticks that are no longer visible', () => {
      // arrange
      component.setFilter({ ...NO_FILTER, unusedOnly: true });
      component.toggleTick(6);
      component.toggleTick(4);

      // act -- a search that hides Travel but keeps Coffee
      component.setFilter({ ...NO_FILTER, unusedOnly: true, search: 'coff' });

      // assert & verify
      expect([...component.tickedIds()]).toEqual([4]);

      // act
      component.setFilter({ ...NO_FILTER, search: 'coff' });

      // assert & verify
      expect(component.tickedIds().size).toBe(0);
      expect(component.panelMode()).toBe('overview');
    });

    it('should only allow a parent to be ticked once all its subcategories are', () => {
      // arrange -- Food is unused but two children have transactions, so it can never be ticked
      loadWith([food, coffee, travel], []);
      component.setFilter({ ...NO_FILTER, unusedOnly: true });

      // assert & verify
      expect(component.tickableIds().has(1)).toBe(false);

      // act
      component.toggleTick(4);

      // assert & verify
      expect(component.tickableIds().has(1)).toBe(true);

      // act
      component.toggleTick(1);
      component.toggleTick(4);

      // assert & verify -- unticking the child drops the parent too
      expect(component.tickedIds().size).toBe(0);
    });
  });

  describe('unsaved edits', () => {
    it('should ask before leaving a dirty form by any route, and proceed on Discard', () => {
      // arrange
      openByName('Travel');
      dirtyForm();
      component.setFilter({ ...NO_FILTER, unusedOnly: true });

      // act and assert & verify -- every route away asks and stays put
      component.openCategory(component.categories().find((c) => c.name === 'Housing')!);
      component.back();
      component.onPanelClose();
      component.startAdd();
      component.toggleTick(4);
      component.viewTransactions();
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(6);
      expect(component.panelMode()).toBe('category');
      expect(mockRouter.navigate).not.toHaveBeenCalled();

      // act
      confirmAccept(3);

      // assert & verify
      expect(component.panelMode()).toBe('add');
    });

    it('should not ask when the form is untouched', () => {
      // arrange
      openByName('Travel');
      fixture.detectChanges();

      // act
      openByName('Housing');

      // assert & verify
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
      expect(component.selectedCategoryId()).toBe(5);
    });
  });

  describe('view transactions', () => {
    it('should open Transactions for the category across all time', () => {
      // arrange
      openByName('Groceries');

      // act
      component.viewTransactions();

      // assert & verify
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions'], {
        queryParams: { categoryName: 'Groceries', period: 'all' },
      });
    });
  });

  describe('no categories', () => {
    it('should open add with no Back or Close, then open the first category created', () => {
      // act
      loadWith([], []);

      // assert & verify
      expect(component.panelMode()).toBe('add');
      expect(component.onlyAddMode()).toBe(true);

      // act
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('add');

      // arrange
      mockCategoryApi.getCategories.mockReturnValue(of([cat(99, 'First')]));

      // act
      component.saveCategory({ name: 'First', type: 'EXPENSE' });

      // assert & verify
      expect(component.panelMode()).toBe('category');
      expect(component.selectedCategoryId()).toBe(99);
      expect(component.onlyAddMode()).toBe(false);
    });

    it('should land in add, not overview, when the last category is deleted', () => {
      // arrange
      loadWith([travel], []);
      openByName('Travel');
      mockCategoryApi.getCategories.mockReturnValue(of([]));

      // act
      component.deleteCategory();
      confirmAccept();
      fixture.detectChanges();

      // assert & verify
      expect(component.panelMode()).toBe('add');
      expect(component.onlyAddMode()).toBe(true);
    });
  });

  describe('selection and bulk delete', () => {
    /** Food (unused) with two unused subcategories, plus Travel: everything can be ticked. */
    const unusedTree = (): void => {
      loadWith([food, coffee, dining, travel], []);
      component.setFilter({ ...NO_FILTER, unusedOnly: true });
    };
    const tick = (...ids: number[]): void => ids.forEach((id) => component.toggleTick(id));
    const deletedIds = (): number[] => mockCategoryApi.deleteCategory.mock.calls.map((c) => c[0]);

    it('should list the ticked names and confirm once, naming them', () => {
      // arrange
      unusedTree();
      tick(6, 4);
      fixture.detectChanges();

      // act
      component.deleteSelected();

      // assert & verify
      expect(
        Array.from(fixture.nativeElement.querySelectorAll('[data-testid="ticked-names"] li')).map(
          (li) => (li as HTMLElement).textContent?.trim(),
        ),
      ).toEqual(['Coffee', 'Travel']);
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(1);
      const message = mockConfirmationService.confirm.mock.calls[0][0].message ?? '';
      expect(message).toContain('2 categories');
      expect(message).toContain('Coffee');
      expect(message).toContain('Travel');
      expect(mockCategoryApi.deleteCategory).not.toHaveBeenCalled();
    });

    it('should delete subcategories before their parent', () => {
      // arrange
      unusedTree();
      tick(4, 3, 1);

      // act
      component.deleteSelected();
      confirmAccept();

      // assert & verify
      expect(deletedIds().slice(0, 2).sort()).toEqual([3, 4]);
      expect(deletedIds()[2]).toBe(1);
    });

    it('should send a level in parallel and wait for it before the next level', () => {
      // arrange
      unusedTree();
      tick(4, 3, 1);
      const pending: Subject<void>[] = [];
      mockCategoryApi.deleteCategory.mockImplementation(() => {
        const request = new Subject<void>();
        pending.push(request);
        return request;
      });

      // act
      component.deleteSelected();
      confirmAccept();

      // assert & verify -- both subcategories requested, the parent not yet
      expect(pending.length).toBe(2);

      // act
      pending.forEach((request) => {
        request.next();
        request.complete();
      });

      // assert & verify
      expect(pending.length).toBe(3);
    });

    it('should report a success, clear the ticks, return to overview and reload', () => {
      // arrange
      unusedTree();
      tick(6, 4);
      mockCategoryApi.getCategories.mockClear();

      // act
      component.deleteSelected();
      confirmAccept();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Deleted 2 categories');
      expect(component.tickedIds().size).toBe(0);
      expect(component.panelMode()).toBe('overview');
      expect(mockCategoryApi.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should use the singular for one category', () => {
      // arrange
      unusedTree();
      tick(6);

      // act
      component.deleteSelected();
      confirmAccept();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Deleted 1 category');
    });

    it("should report a failure with the server's message and still reload", () => {
      // arrange
      unusedTree();
      tick(6, 4);
      mockCategoryApi.deleteCategory.mockImplementation((id: number) =>
        id === 4
          ? throwError(() => ({ error: { detail: "Category 'Coffee' is used by a rule" } }))
          : of(undefined),
      );
      mockCategoryApi.getCategories.mockClear();

      // act
      component.deleteSelected();
      confirmAccept();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith(
        "Deleted 1, 1 failed: Category 'Coffee' is used by a rule",
      );
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockCategoryApi.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should skip a parent whose subcategory failed and count it as failed', () => {
      // arrange
      unusedTree();
      tick(4, 3, 1);
      mockCategoryApi.deleteCategory.mockImplementation((id: number) =>
        id === 4 ? throwError(() => ({ error: { detail: 'Refused' } })) : of(undefined),
      );

      // act
      component.deleteSelected();
      confirmAccept();

      // assert & verify
      expect(deletedIds()).not.toContain(1);
      expect(mockToast.error).toHaveBeenCalledWith('Deleted 1, 2 failed: Refused');
    });

    it('should ignore a second bulk delete while one is running, and while loading', () => {
      // arrange
      unusedTree();
      tick(6);
      mockCategoryApi.deleteCategory.mockReturnValue(new Subject<void>());

      // act
      component.deleteSelected();
      confirmAccept();
      component.deleteSelected();

      // assert & verify
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(true);
    });

    it('should clear the selection from the panel', () => {
      // arrange
      unusedTree();
      tick(6);

      // act
      component.clearSelection();

      // assert & verify
      expect(component.tickedIds().size).toBe(0);
      expect(component.panelMode()).toBe('overview');
    });
  });

  describe('layout and states', () => {
    const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');

    it('should always render the panel, on the overview by default, beside the tree and filters', () => {
      // assert & verify
      expect(aside().getAttribute('aria-label')).toBe('Overview');
      expect(fixture.nativeElement.querySelector('app-category-overview')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-category-filters')).toBeTruthy();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="open-category"]').length).toBe(
        4,
      );
    });

    it('should show the full skeleton on the first load with no panel yet', () => {
      // arrange
      const first = TestBed.createComponent(CategoriesComponent);
      mockCategoryApi.getCategories.mockReturnValue(new Subject<Category[]>());

      // act
      first.detectChanges();

      // assert & verify
      expect(first.nativeElement.querySelector('[aria-busy="true"] p-skeleton')).toBeTruthy();
      expect(first.nativeElement.querySelector('app-side-panel')).toBeNull();
    });

    it('should keep the same panel element mounted across a reload and a save', () => {
      // arrange
      const panel = fixture.nativeElement.querySelector('app-side-panel');
      openByName('Travel');

      // act
      component.saveCategory({ id: 6, name: 'Trips', type: 'EXPENSE' });
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBe(panel);
    });

    it('should show No categories yet beside the add form when there are none', () => {
      // act
      loadWith([], []);

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('No categories yet');
      expect(fixture.nativeElement.querySelector('app-category-edit-form')).toBeTruthy();
      expect(aside().getAttribute('aria-label')).toBe('Add category');
    });

    it('should explain an empty filter result and offer a working Clear filters button', () => {
      // act
      component.setFilter({ ...NO_FILTER, search: 'zzzz' });
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('No categories match these filters');

      // act
      fixture.nativeElement
        .querySelector('[data-testid="clear-filters"] button, button[data-testid="clear-filters"]')
        .click();
      fixture.detectChanges();

      // assert & verify
      expect(component.filtering()).toBe(false);
      expect(fixture.nativeElement.querySelectorAll('[data-testid="open-category"]').length).toBe(
        4,
      );
    });

    it('should retry from the error state', () => {
      // arrange
      mockCategoryApi.getCategories.mockReturnValue(throwError(() => new Error('down')));
      component.loadData();
      fixture.detectChanges();
      mockCategoryApi.getCategories.mockReturnValue(of(flat));

      // act
      fixture.nativeElement.querySelector('app-page-error-state button').click();
      fixture.detectChanges();

      // assert & verify
      expect(component.loadError()).toBe(false);
      expect(component.categories().length).toBe(8);
    });

    it('should no longer render the old table, nested table or New Category button', () => {
      // assert & verify
      expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('New Category');
      expect(fixture.nativeElement.textContent).not.toContain('EXPENSE');
    });
  });

  describe('focus', () => {
    const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');
    const rowButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="open-category"]');

    it('should not take focus on page load', async () => {
      // arrange
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).not.toBe(aside());
    });

    it('should move focus into the panel when a row is opened and back to that row on return', async () => {
      // arrange
      const row = rowButton();
      row.focus();

      // act
      component.openCategory(component.categories().find((c) => c.id === 1)!);
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());

      // act
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(row);
    });

    it('should focus the panel instead when the element that opened it is gone', async () => {
      // arrange
      rowButton().focus();
      component.openCategory(component.categories().find((c) => c.id === 1)!);
      fixture.detectChanges();
      await fixture.whenStable();

      // act -- the opening row disappears, then the panel returns to overview
      component.setFilter({ ...NO_FILTER, search: 'travel' });
      fixture.detectChanges();
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());
    });

    it('should leave focus on the search box while the filters change on the overview', async () => {
      // arrange
      const search = fixture.nativeElement.querySelector(
        'input[aria-label="Search categories"]',
      ) as HTMLInputElement;
      search.focus();

      // act
      component.setFilter({ ...NO_FILTER, search: 'a' });
      component.setFilter({ ...NO_FILTER, search: 'ab' });
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(search);
    });

    it('should move focus into the panel when add opens', async () => {
      // arrange
      (document.activeElement as HTMLElement | null)?.blur();

      // act
      component.startAdd();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());
    });
  });

  describe('typing while a reload finishes', () => {
    it('should keep what was typed in the add form when a reload completes', () => {
      // arrange
      component.startAdd();
      fixture.detectChanges();
      const form = fixture.debugElement.query(By.directive(CategoryEditFormComponent))
        .componentInstance as CategoryEditFormComponent;
      form.form.patchValue({ name: 'Half typed' });
      form.form.markAsDirty();

      // act -- the reload from an earlier save finishes now
      loadWith(flat);
      fixture.detectChanges();

      // assert & verify
      const after = fixture.debugElement.query(By.directive(CategoryEditFormComponent))
        .componentInstance as CategoryEditFormComponent;
      expect(after.form.getRawValue().name).toBe('Half typed');
    });

    it('should keep an open category form when a reload completes', () => {
      // arrange
      openByName('Travel');
      fixture.detectChanges();
      const form = fixture.debugElement.query(By.directive(CategoryEditFormComponent))
        .componentInstance as CategoryEditFormComponent;
      form.form.patchValue({ name: 'Trips' });

      // act
      loadWith(flat);
      fixture.detectChanges();

      // assert & verify
      const after = fixture.debugElement.query(By.directive(CategoryEditFormComponent))
        .componentInstance as CategoryEditFormComponent;
      expect(after.form.getRawValue().name).toBe('Trips');
    });
  });
});
