import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TransactionBulkFormComponent } from './transaction-bulk-form.component';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { Category, CategoryGroup, CategoryType } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Transaction } from '@models/transaction.model';

describe('TransactionBulkFormComponent', () => {
  let component: TransactionBulkFormComponent;
  let fixture: ComponentFixture<TransactionBulkFormComponent>;
  let mockCategoryApi: Mocked<Pick<CategoryApiService, 'getGroupedCategories'>>;
  let mockMerchantApi: Mocked<Pick<MerchantApiService, 'getMerchants'>>;

  const category = (id: number, name: string): Category =>
    ({
      id,
      userId: 1,
      name,
      type: CategoryType.EXPENSE,
      parent: null,
      icon: '',
      color: '',
    }) as Category;

  const rent = category(1, 'Rent');
  const mockGroups: CategoryGroup[] = [{ parent: rent, items: [rent] }];

  const costco: Merchant = {
    id: 1,
    userId: 1,
    name: 'Costco',
    city: null,
    state: null,
    postalCode: null,
    country: null,
  };
  const samsClub: Merchant = {
    id: 2,
    userId: 1,
    name: "Sam's Club",
    city: null,
    state: null,
    postalCode: null,
    country: null,
  };
  const mockMerchants: Merchant[] = [costco, samsClub];

  const mockTransactions: Transaction[] = [{ id: 1 } as Transaction];

  beforeEach(async () => {
    mockCategoryApi = { getGroupedCategories: vi.fn().mockReturnValue(of(mockGroups)) };
    mockMerchantApi = {
      getMerchants: vi.fn().mockReturnValue(
        of({
          content: mockMerchants,
          page: { totalElements: mockMerchants.length, totalPages: 1, number: 0, size: 20 },
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [TransactionBulkFormComponent],
      providers: [
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: MerchantApiService, useValue: mockMerchantApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionBulkFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('transactions', mockTransactions);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('category loading (constructor-time, not gated behind dialog visibility)', () => {
    it('should load and reshape grouped categories into PrimeNG-default-compatible SelectItemGroups', () => {
      expect(mockCategoryApi.getGroupedCategories).toHaveBeenCalled();
      expect(component.categoryGroups()).toEqual([
        { label: 'Rent', items: [{ label: 'Rent', value: rent }] },
      ]);
    });
  });

  describe('merchant search (PF-320: server-side, triggered by the autocomplete, not preloaded)', () => {
    it('should not call getMerchants until a search is triggered', () => {
      expect(mockMerchantApi.getMerchants).not.toHaveBeenCalled();
    });

    it('should search by the typed query and reshape results into PrimeNG-default-compatible options', () => {
      component.filterMerchants({ query: 'cos' });

      expect(mockMerchantApi.getMerchants).toHaveBeenCalledWith('cos', { page: 0, size: 20 });
      expect(component.merchantOptions()).toEqual([
        { label: 'Costco', value: costco },
        { label: "Sam's Club", value: samsClub },
      ]);
    });
  });

  // PF-869
  describe("keeping the user's choices", () => {
    it('should keep a chosen category, merchant and description when the selection changes', () => {
      // arrange
      component.form.patchValue({
        updateCategory: true,
        category: rent,
        updateMerchant: true,
        merchant: costco,
        updateDescription: true,
        description: 'Monthly',
      });

      // act -- the user ticks another row while the form is open
      fixture.componentRef.setInput('transactions', [{ id: 1 }, { id: 2 }] as Transaction[]);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue()).toEqual({
        updateCategory: true,
        category: rent,
        updateMerchant: true,
        merchant: costco,
        updateDescription: true,
        description: 'Monthly',
      });
      expect(component.transactionCount()).toBe(2);
    });
  });

  describe('large batch warning', () => {
    it('should state the size of the batch and not claim it is queued for background work', () => {
      // act
      fixture.componentRef.setInput(
        'transactions',
        Array.from({ length: 51 }, (_, i) => ({ id: i }) as Transaction),
      );
      fixture.detectChanges();

      // assert & verify -- the update is applied straight away, not queued
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Large batch');
      expect(text).toContain('51 transactions');
      expect(text).not.toContain('background');
      expect(text).not.toContain('queued');
    });
  });

  describe('transactionCount / isLargeUpdate', () => {
    it('should count the current transaction batch', () => {
      fixture.componentRef.setInput('transactions', [
        { id: 1 } as Transaction,
        { id: 2 } as Transaction,
      ]);

      expect(component.transactionCount()).toBe(2);
    });

    it('should not be a large update at exactly 50', () => {
      fixture.componentRef.setInput(
        'transactions',
        Array.from({ length: 50 }, (_, i) => ({ id: i }) as Transaction),
      );

      expect(component.isLargeUpdate()).toBe(false);
    });

    it('should be a large update just above 50', () => {
      fixture.componentRef.setInput(
        'transactions',
        Array.from({ length: 51 }, (_, i) => ({ id: i }) as Transaction),
      );

      expect(component.isLargeUpdate()).toBe(true);
    });
  });

  describe('isValid', () => {
    it('should be falsy when no field is toggled on', () => {
      expect(component.isValid()).toBeFalsy();
    });

    it('should be false when category is toggled on but nothing is selected', () => {
      component.form.controls.updateCategory.setValue(true);

      expect(component.isValid()).toBe(false);
    });

    it('should be true when category is toggled on and selected', () => {
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);

      expect(component.isValid()).toBe(true);
    });

    it('should be false when the merchant override is toggled on but nothing is selected', () => {
      component.form.controls.updateMerchant.setValue(true);

      expect(component.isValid()).toBe(false);
    });

    it('should be true when the merchant override is toggled on and a merchant is selected', () => {
      component.form.controls.updateMerchant.setValue(true);
      component.form.controls.merchant.setValue(costco);

      expect(component.isValid()).toBe(true);
    });

    it('should be false when the description override is toggled on but blank', () => {
      component.form.controls.updateDescription.setValue(true);
      component.form.controls.description.setValue('   ');

      expect(component.isValid()).toBe(false);
    });

    it('should be true when the description override is toggled on and non-blank', () => {
      component.form.controls.updateDescription.setValue(true);
      component.form.controls.description.setValue('Business trip');

      expect(component.isValid()).toBe(true);
    });

    it('should require every toggled-on field to be filled, not just one of them', () => {
      // arrange -- category filled, but merchant toggled on and left unselected
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateMerchant.setValue(true);

      // act & assert & verify
      expect(component.isValid()).toBe(false);
    });

    it('should be true when every toggled-on field across all three is filled', () => {
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateMerchant.setValue(true);
      component.form.controls.merchant.setValue(costco);
      component.form.controls.updateDescription.setValue(true);
      component.form.controls.description.setValue('Business trip');

      expect(component.isValid()).toBe(true);
    });
  });

  describe('onSave', () => {
    it('should not emit when the form is invalid', () => {
      const saveSpy = vi.fn();
      component.apply.subscribe(saveSpy);

      component.onSave();

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should emit only the toggled-on fields', () => {
      // arrange
      const saveSpy = vi.fn();
      component.apply.subscribe(saveSpy);
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          updateCategory: true,
          category: rent,
          updateMerchant: false,
          updateDescription: false,
        }),
      );
    });

    it('should emit the real, selected Merchant object -- no more unsafe cast around a typed name', () => {
      // PF-395: merchant is now a real picker bound to Merchant objects (MerchantApiService
      // .getMerchants()), not a free-text input wrapped in an unsafe `as Merchant` cast.
      const saveSpy = vi.fn();
      component.apply.subscribe(saveSpy);
      component.form.controls.updateMerchant.setValue(true);
      component.form.controls.merchant.setValue(costco);

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ updateMerchant: true, merchant: costco }),
      );
    });

    it('should trim the emitted description override', () => {
      component.form.controls.updateDescription.setValue(true);
      component.form.controls.description.setValue('  Business trip  ');
      const saveSpy = vi.fn();
      component.apply.subscribe(saveSpy);

      component.onSave();

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Business trip' }),
      );
    });

    it("bug-adjacent characterization: a field's value is emitted even if its own toggle is off, as long as the form overall is valid", () => {
      // arrange -- category toggled on (making the form valid) and selected; merchant has a
      // leftover value from before its toggle was switched back off. onSave()'s `category`/
      // `merchant`/`description` fields are each computed independently of their own toggle
      // (only the toggle flags themselves gate isValid()) -- so a stale, untoggled field's value
      // still rides along in the emitted payload. Not fixed here: PF-395 only scopes the
      // merchant-mapping gap, not this separate, pre-existing quirk.
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateMerchant.setValue(true);
      component.form.controls.merchant.setValue(costco);
      component.form.controls.updateMerchant.setValue(false); // toggled back off, value left behind
      const saveSpy = vi.fn();
      component.apply.subscribe(saveSpy);

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ updateMerchant: false, merchant: costco }),
      );
    });
  });

  describe('rendering', () => {
    it(
      'bug found, not fixed here: [disabled]="!form.value.x" on a native formControlName ' +
        'input never actually disables it, despite that clearly being the intent (label text and ' +
        "ring-highlight styling both treat this field as gated by its toggle) -- Angular's own " +
        "reactive-forms directive manages a native element's disabled state and overrides a plain " +
        "property binding attempting the same thing (confirmed via Angular's own runtime warning: " +
        '"It looks like you\'re using the disabled attribute with a reactive form directive"). ' +
        'Fixing this properly means enabling/disabling the FormControl itself, a real design ' +
        'decision -- left to a dedicated bug ticket, not fixed as part of PF-395 (scoped only to ' +
        'the merchant-mapping gap).',
      () => {
        // arrange & act
        const descriptionInput = fixture.nativeElement.querySelector(
          'input[formcontrolname="description"]',
        );

        // assert & verify -- documents current (broken) behavior, unchanged by PF-395
        expect(descriptionInput.disabled).toBe(false);
      },
    );

    // PF-320: migrated off p-select (a preloaded, client-filtered dropdown) to p-autoComplete
    // (a server-search-driven picker) once the backend endpoint stopped returning every merchant
    // in one call. PrimeNG's AutoComplete has no dedicated `disabled` Signal input the way Select
    // does, so the toggle is reflected via `readonly` plus a visual class pair instead.
    const findMerchantAutoComplete = (): HTMLElement =>
      fixture.nativeElement.querySelector('p-autocomplete');
    const findMerchantInput = (): HTMLInputElement =>
      findMerchantAutoComplete().querySelector('input')!;

    it('should correctly disable the merchant picker until its own toggle is switched on', () => {
      expect(findMerchantInput().readOnly).toBe(true);
      expect(findMerchantAutoComplete().classList).toContain('pointer-events-none');
    });

    it('should enable the merchant picker once its toggle is switched on', () => {
      component.form.controls.updateMerchant.setValue(true);
      fixture.detectChanges();

      expect(findMerchantInput().readOnly).toBe(false);
      expect(findMerchantAutoComplete().classList).not.toContain('pointer-events-none');
    });

    it('should show the combined validation error only once a toggle is on and the form is still invalid', () => {
      // before any toggle
      expect(fixture.nativeElement.textContent).not.toContain(
        'Fill in every field you switched on',
      );

      // toggled on, still blank
      component.form.controls.updateDescription.setValue(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Fill in every field you switched on');

      // filled in
      component.form.controls.description.setValue('Business trip');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(
        'Fill in every field you switched on',
      );
    });

    it('should say how many transactions the fields will change', () => {
      expect(fixture.nativeElement.textContent).toContain('1 selected transactions');
    });
  });

  describe('accessibility (PF-805)', () => {
    // real browser test (verify.sh runs Chromium, not jsdom) -- HTMLLabelElement.control uses the
    // same labelable-element resolution algorithm the accessibility tree does, so this is a direct
    // check of the actual for/id association a screen reader would see, not just that the lint
    // rule is satisfied
    it.each([
      ['bulk-edit-merchant', 'Reassign Merchant'],
      ['bulk-edit-description', 'Override Memo'],
    ])('label "%s" resolves to its control via for/id (%s)', (id) => {
      const label: HTMLLabelElement | null = fixture.nativeElement.querySelector(
        `label[for="${id}"]`,
      );
      expect(label).not.toBeNull();
      expect(label!.control).not.toBeNull();
      expect(label!.control!.id).toBe(id);
    });

    it(
      'p-select renders as a role="combobox" span (not a native labelable element) -- ' +
        'aria-labelledby, not for/id, is the correct mechanism, and must win over the ' +
        'placeholder-derived aria-label PrimeNG sets automatically',
      () => {
        const combo: HTMLElement | null = fixture.nativeElement.querySelector('[role="combobox"]');
        expect(combo).not.toBeNull();
        expect(combo!.getAttribute('aria-labelledby')).toBe('bulk-edit-category-label');
        const label = fixture.nativeElement.querySelector('#bulk-edit-category-label');
        expect(label).not.toBeNull();
        expect(label!.textContent!.trim()).toBe('Category');
      },
    );
  });

  describe('keep as is, valid and submit', () => {
    it('should describe a field that is the same across the selection', () => {
      // act
      fixture.componentRef.setInput('transactions', [
        { id: 1, category: { id: 5, name: 'Groceries' } },
        { id: 2, category: { id: 5, name: 'Groceries' } },
      ]);
      fixture.detectChanges();

      // assert & verify
      expect(component.categorySummary()).toBe('Keep as is (Groceries)');
    });

    it('should say how many different values a field has across the selection', () => {
      // act
      fixture.componentRef.setInput('transactions', [
        { id: 1, category: { id: 5, name: 'Groceries' } },
        { id: 2, category: null },
        { id: 3, category: { id: 6, name: 'Dining' } },
      ]);
      fixture.detectChanges();

      // assert & verify
      expect(component.categorySummary()).toBe('Keep as is, 3 different');
    });

    it('should not be valid, and emit nothing, until at least one field is changed', () => {
      // arrange
      fixture.componentRef.setInput('transactions', [{ id: 1 }, { id: 2 }]);
      fixture.detectChanges();
      const applied = vi.fn();
      component.apply.subscribe(applied);

      // act
      component.submit();

      // assert & verify
      expect(component.valid()).toBe(false);
      expect(applied).not.toHaveBeenCalled();
    });

    it('should send only the fields the user changed', () => {
      // arrange
      fixture.componentRef.setInput('transactions', [{ id: 1 }, { id: 2 }]);
      fixture.detectChanges();
      const applied = vi.fn();
      component.apply.subscribe(applied);

      // act
      component.setCategory({ id: 9, name: 'Fuel' } as never);
      component.submit();

      // assert & verify
      expect(applied).toHaveBeenCalledWith(
        expect.objectContaining({
          updateCategory: true,
          updateMerchant: false,
          updateDescription: false,
        }),
      );
    });
  });
});
