import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BulkEditDialogComponent } from './bulk-edit-dialog.component';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { Category, CategoryGroup, CategoryType } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Transaction } from '@models/transaction.model';

describe('BulkEditDialogComponent', () => {
  let component: BulkEditDialogComponent;
  let fixture: ComponentFixture<BulkEditDialogComponent>;
  let mockCategoryApi: any;
  let mockMerchantApi: any;

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
    originalName: 'COSTCO WHSE #123',
    cleanName: 'Costco',
  };
  const noCleanName: Merchant = { id: 2, userId: 1, originalName: 'RAW MERCHANT', cleanName: '' };
  const mockMerchants: Merchant[] = [costco, noCleanName];

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
      imports: [BulkEditDialogComponent],
      providers: [
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: MerchantApiService, useValue: mockMerchantApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkEditDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
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
        { label: 'RAW MERCHANT', value: noCleanName },
      ]);
    });

    it("should fall back through cleanName -> originalName -> 'Unknown Merchant'", () => {
      mockMerchantApi.getMerchants.mockReturnValue(
        of({
          content: [{ id: 3, userId: 1, originalName: '', cleanName: '' }],
          page: { totalElements: 1, totalPages: 1, number: 0, size: 20 },
        }),
      );

      component.filterMerchants({ query: '' });

      expect(component.merchantOptions()).toEqual([
        {
          label: 'Unknown Merchant',
          value: { id: 3, userId: 1, originalName: '', cleanName: '' },
        },
      ]);
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
      component.save.subscribe(saveSpy);

      component.onSave();

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should emit only the toggled-on fields', () => {
      // arrange
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);
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
      component.save.subscribe(saveSpy);
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
      component.save.subscribe(saveSpy);

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
      component.save.subscribe(saveSpy);

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ updateMerchant: false, merchant: costco }),
      );
    });
  });

  describe('onCancel', () => {
    it('should close the dialog', () => {
      component.onCancel();

      expect(component.visible()).toBe(false);
    });
  });

  describe('reset-on-close effect', () => {
    it('should reset the form once the dialog becomes hidden', () => {
      // arrange
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateMerchant.setValue(true);
      component.form.controls.merchant.setValue(costco);

      // act
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.updateCategory.value).toBe(false);
      expect(component.form.controls.category.value).toBeNull();
      expect(component.form.controls.merchant.value).toBeNull();
    });

    it('should not reset the form while the dialog remains open', () => {
      // arrange & act
      component.form.controls.updateCategory.setValue(true);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.updateCategory.value).toBe(true);
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
      expect(fixture.nativeElement.textContent).not.toContain('Selected fields must be populated');

      // toggled on, still blank
      component.form.controls.updateDescription.setValue(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Selected fields must be populated');

      // filled in
      component.form.controls.description.setValue('Business trip');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Selected fields must be populated');
    });

    it('should show the live transaction count in the dialog header', () => {
      expect(fixture.nativeElement.textContent).toContain('Bulk Management: 1 Selected');
    });
  });
});
