import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {BulkEditDialogComponent} from './bulk-edit-dialog.component';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {Category, CategoryGroup, CategoryType} from '@models/category.model';
import {Transaction} from '@models/transaction.model';

describe('BulkEditDialogComponent', () => {
  let component: BulkEditDialogComponent;
  let fixture: ComponentFixture<BulkEditDialogComponent>;
  let mockCategoryApi: any;

  const category = (id: number, name: string): Category =>
    ({id, userId: 1, name, type: CategoryType.EXPENSE, parent: null, icon: '', color: ''}) as Category;

  const rent = category(1, 'Rent');
  const mockGroups: CategoryGroup[] = [{parent: rent, items: [rent]}];

  const mockTransactions: Transaction[] = [{id: 1} as Transaction];

  beforeEach(async () => {
    mockCategoryApi = {getGroupedCategories: vi.fn().mockReturnValue(of(mockGroups))};

    await TestBed.configureTestingModule({
      imports: [BulkEditDialogComponent],
      providers: [{provide: CategoryApiService, useValue: mockCategoryApi}]
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
        {label: 'Rent', items: [{label: 'Rent', value: rent}]}
      ]);
    });
  });

  describe('transactionCount / isLargeUpdate', () => {
    it('should count the current transaction batch', () => {
      fixture.componentRef.setInput('transactions', [{id: 1} as Transaction, {id: 2} as Transaction]);

      expect(component.transactionCount()).toBe(2);
    });

    it('should not be a large update at exactly 50', () => {
      fixture.componentRef.setInput('transactions', Array.from({length: 50}, (_, i) => ({id: i}) as Transaction));

      expect(component.isLargeUpdate()).toBe(false);
    });

    it('should be a large update just above 50', () => {
      fixture.componentRef.setInput('transactions', Array.from({length: 51}, (_, i) => ({id: i}) as Transaction));

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

    it('should be false when the merchant override is toggled on but blank', () => {
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('   ');

      expect(component.isValid()).toBe(false);
    });

    it('should be true when the merchant override is toggled on and non-blank', () => {
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('Costco');

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
      // arrange -- category filled, but merchant toggled on and left blank
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('');

      // act & assert & verify
      expect(component.isValid()).toBe(false);
    });

    it('should be true when every toggled-on field across all three is filled', () => {
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('Costco');
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

    it('should emit only the toggled-on fields, translating updateVendor to updateMerchant', () => {
      // arrange
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        updateCategory: true, category: rent, updateMerchant: false, updateDescription: false
      }));
    });

    it('should wrap the free-text merchant override as a partial Merchant with only cleanName set', () => {
      // arrange -- this dialog only ever collects a replacement display name, not a full merchant
      // entity (confirmed against the template: a plain text input labeled "Override Merchant",
      // not a merchant picker) -- BulkEditData.merchant is only ever partially populated as a
      // result, real behavior as of this unwired (PF-395) component, not assumed
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('Costco');

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        updateMerchant: true, merchant: {cleanName: 'Costco'}
      }));
    });

    it("bug-adjacent characterization: does not trim the emitted merchant override, though isValid()'s own blank check does trim", () => {
      // arrange -- typed with padding; isValid() trims to check non-blankness, but onSave()'s own
      // payload construction does not apply the same trim, unlike the description field below
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('  Costco  ');
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);

      // act
      component.onSave();

      // assert & verify -- documents current (untrimmed) behavior; worth a second look if PF-395
      // ever surfaces a leading/trailing-space bug in a real merchant override
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({merchant: {cleanName: '  Costco  '}}));
    });

    it('should trim the emitted description override', () => {
      component.form.controls.updateDescription.setValue(true);
      component.form.controls.description.setValue('  Business trip  ');
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);

      component.onSave();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({description: 'Business trip'}));
    });

    it("bug-adjacent characterization: a field's value is emitted even if its own toggle is off, as long as the form overall is valid", () => {
      // arrange -- category toggled on (making the form valid) and selected; merchant has a
      // leftover value from before its toggle was switched back off. onSave()'s `category`/
      // `merchant`/`description` fields are each computed independently of their own toggle
      // (only the toggle flags themselves gate isValid()) -- so a stale, untoggled field's value
      // still rides along in the emitted payload. Not fixed here: this component has no wired
      // parent yet (PF-395), so there's no live consumer this could currently mislead.
      component.form.controls.updateCategory.setValue(true);
      component.form.controls.category.setValue(rent);
      component.form.controls.updateVendor.setValue(true);
      component.form.controls.merchant.setValue('Costco');
      component.form.controls.updateVendor.setValue(false); // toggled back off, value left behind
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);

      // act
      component.onSave();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        updateMerchant: false, merchant: {cleanName: 'Costco'}
      }));
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

      // act
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.updateCategory.value).toBe(false);
      expect(component.form.controls.category.value).toBeNull();
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
    it("bug found, not fixed here: [disabled]=\"!form.value.x\" on a formControlName element " +
      "never actually disables the field, despite that clearly being the intent (label text, " +
      "placeholder copy, and the ring-highlight styling all treat these fields as gated by their " +
      "toggle) -- Angular's own reactive-forms directive manages the disabled state of a control " +
      "with formControlName and overrides a plain property binding attempting the same thing " +
      "(confirmed via Angular's own runtime warning: \"It looks like you're using the disabled " +
      "attribute with a reactive form directive\"). Fixing this properly means enabling/disabling " +
      "the FormControl itself (e.g. via an effect reacting to each toggle), which is a real design " +
      "decision, not a one-line swap -- left to a dedicated bug ticket rather than fixed inline " +
      'during test backfill for a component with no wired parent yet (PF-395).',
      () => {
        // arrange & act
        const merchantInput = fixture.nativeElement.querySelector('input[formcontrolname="merchant"]');
        const descriptionInput = fixture.nativeElement.querySelector('input[formcontrolname="description"]');

        // assert & verify -- documents current (broken) behavior
        expect(merchantInput.disabled).toBe(false);
        expect(descriptionInput.disabled).toBe(false);
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
