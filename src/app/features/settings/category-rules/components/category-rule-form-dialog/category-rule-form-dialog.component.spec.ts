import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { Select } from 'primeng/select';

import { CategoryRuleFormDialogComponent } from './category-rule-form-dialog.component';
import { CategoryRuleApiService } from '../../services/category-rule-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { Category } from '@models/category.model';

describe('CategoryRuleFormDialogComponent', () => {
  let component: CategoryRuleFormDialogComponent;
  let fixture: ComponentFixture<CategoryRuleFormDialogComponent>;
  let mockRuleApi: any;
  let mockCategoryApi: any;
  let mockToast: any;

  const mockCategory: Category = { id: 50, userId: 1, name: 'Shopping' } as unknown as Category;

  beforeEach(async () => {
    mockRuleApi = { createRule: vi.fn().mockReturnValue(of(1)) };
    mockCategoryApi = { getGroupedCategories: vi.fn().mockReturnValue(of([])) };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CategoryRuleFormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: CategoryRuleApiService, useValue: mockRuleApi },
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryRuleFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  it('should default matchType to OR when the dialog opens', () => {
    // assert & verify
    expect(component.form.controls.matchType.value).toBe('OR');
  });

  it('PF-315: should mark keywordsInput invalid when blank', () => {
    // act
    component.form.controls.keywordsInput.setValue('');

    // assert & verify
    expect(component.form.controls.keywordsInput.invalid).toBe(true);
  });

  it('PF-315: should mark keywordsInput invalid when only commas and whitespace', () => {
    // act
    component.form.controls.keywordsInput.setValue(' , , ');

    // assert & verify
    expect(component.form.controls.keywordsInput.invalid).toBe(true);
  });

  it('PF-315: should split, trim, and filter a comma-separated keyword string on submit', () => {
    // arrange
    component.form.controls.keywordsInput.setValue('AMZN, MKTP ,, US');
    component.form.controls.category.setValue(mockCategory);

    // act
    component.onSubmit();

    // assert & verify
    expect(mockRuleApi.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['AMZN', 'MKTP', 'US'] }),
    );
  });

  it('PF-315: should submit a single keyword as a one-element array, matching pre-PF-315 rules', () => {
    // arrange
    component.form.controls.keywordsInput.setValue('WALMART');
    component.form.controls.category.setValue(mockCategory);

    // act
    component.onSubmit();

    // assert & verify
    expect(mockRuleApi.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['WALMART'], matchType: 'OR' }),
    );
  });

  it('PF-315: should submit the selected matchType', () => {
    // arrange
    component.form.controls.keywordsInput.setValue('AMZN, MKTP');
    component.form.controls.matchType.setValue('AND');
    component.form.controls.category.setValue(mockCategory);

    // act
    component.onSubmit();

    // assert & verify
    expect(mockRuleApi.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ matchType: 'AND' }),
    );
  });

  it('should not call the API when the form is invalid', () => {
    // arrange
    component.form.controls.keywordsInput.setValue('');
    component.form.controls.category.setValue(mockCategory);

    // act
    component.onSubmit();

    // assert & verify
    expect(mockRuleApi.createRule).not.toHaveBeenCalled();
  });

  describe('onShow', () => {
    it('should load and populate the grouped category dropdown', () => {
      // arrange
      const group = { parent: mockCategory, items: [mockCategory] };
      mockCategoryApi.getGroupedCategories.mockReturnValue(of([group]));

      // act
      component.onShow();

      // assert & verify
      expect(mockCategoryApi.getGroupedCategories).toHaveBeenCalled();
      expect(component.categoryGroups()).toEqual([group]);
    });

    it('should reset the form to blank defaults and clear any previous error', () => {
      // arrange -- dirty the form and set a stale error first
      component.form.controls.keywordsInput.setValue('WALMART');
      component.form.controls.category.setValue(mockCategory);
      component.form.controls.priority.setValue(5);
      component.errorMessage.set('stale error');

      // act
      component.onShow();

      // assert & verify
      expect(component.form.controls.keywordsInput.value).toBe('');
      expect(component.form.controls.category.value).toBeNull();
      expect(component.form.controls.priority.value).toBe(0);
      expect(component.errorMessage()).toBeNull();
    });

    it('should toast an error when loading categories fails', () => {
      // arrange
      mockCategoryApi.getGroupedCategories.mockReturnValue(
        throwError(() => new Error('network error')),
      );

      // act
      component.onShow();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load categories.');
    });
  });

  describe('rule priority', () => {
    it('should default to 0', () => {
      expect(component.form.controls.priority.value).toBe(0);
    });

    it('should reject a negative priority', () => {
      component.form.controls.priority.setValue(-1);

      expect(component.form.controls.priority.invalid).toBe(true);
    });

    it('should submit the entered priority', () => {
      // arrange
      component.form.controls.keywordsInput.setValue('AMZN');
      component.form.controls.category.setValue(mockCategory);
      component.form.controls.priority.setValue(10);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockRuleApi.createRule).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 10 }),
      );
    });
  });

  describe('amount range', () => {
    it('should default both bounds to no limit (null)', () => {
      expect(component.form.controls.minAmount.value).toBeNull();
      expect(component.form.controls.maxAmount.value).toBeNull();
    });

    it('should reject a negative minAmount or maxAmount', () => {
      component.form.controls.minAmount.setValue(-5);
      component.form.controls.maxAmount.setValue(-1);

      expect(component.form.controls.minAmount.invalid).toBe(true);
      expect(component.form.controls.maxAmount.invalid).toBe(true);
    });

    it('should accept a zero bound', () => {
      component.form.controls.minAmount.setValue(0);

      expect(component.form.controls.minAmount.invalid).toBe(false);
    });

    it('should submit both bounds unchanged, including a null (unset) bound', () => {
      // arrange
      component.form.controls.keywordsInput.setValue('AMZN');
      component.form.controls.category.setValue(mockCategory);
      component.form.controls.minAmount.setValue(20);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockRuleApi.createRule).toHaveBeenCalledWith(
        expect.objectContaining({ minAmount: 20, maxAmount: null }),
      );
    });
  });

  describe('category assignment', () => {
    it('should be invalid with no category selected', () => {
      component.form.controls.keywordsInput.setValue('AMZN');

      expect(component.form.invalid).toBe(true);
    });

    it("should submit the category's id, not the full category object", () => {
      // arrange
      component.form.controls.keywordsInput.setValue('AMZN');
      component.form.controls.category.setValue(mockCategory);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockRuleApi.createRule).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 50 }),
      );
    });

    it("should wire the p-select's group header to the parent's own name field (PF-352)", () => {
      // arrange & act -- CategoryGroup is shaped {parent, items}, with no `groupLabel` field of
      // its own; template previously bound groupLabel="groupLabel" (always undefined -> blank
      // group headers in the real dropdown). PrimeNG's optionGroupLabel resolves dot-paths via
      // resolveFieldData, so "parent.name" is a real, working fix, not a workaround.
      const categorySelect = fixture.debugElement
        .queryAll(By.directive(Select))
        .find((de): boolean => de.componentInstance.optionLabel === 'name')!;

      // assert & verify
      expect(categorySelect.componentInstance.optionGroupLabel).toBe('parent.name');
    });
  });

  describe('onSubmit success/failure', () => {
    const submitValidForm = (): void => {
      component.form.controls.keywordsInput.setValue('AMZN');
      component.form.controls.category.setValue(mockCategory);
      component.onSubmit();
    };

    it('should toast success, emit save, and close the dialog on success', () => {
      // arrange
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);

      // act
      submitValidForm();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Category rule created.');
      expect(saveSpy).toHaveBeenCalled();
      expect(component.visible()).toBe(false);
    });

    it('should ignore a resubmit while a save is already in flight', () => {
      // arrange
      component.loading.set(true);

      // act
      submitValidForm();

      // assert & verify
      expect(mockRuleApi.createRule).not.toHaveBeenCalled();
    });

    it('should surface the API error message and keep the dialog open on failure', () => {
      // arrange
      mockRuleApi.createRule.mockReturnValue(
        throwError(() => ({ error: { detail: 'Duplicate rule' } })),
      );

      // act
      submitValidForm();

      // assert & verify
      expect(component.errorMessage()).toBe('Duplicate rule');
      expect(component.loading()).toBe(false);
      expect(component.visible()).toBe(true);
    });

    it('should fall back to a generic error message when the API error has no detail', () => {
      // arrange
      mockRuleApi.createRule.mockReturnValue(throwError(() => ({ error: {} })));

      // act
      submitValidForm();

      // assert & verify
      expect(component.errorMessage()).toBe('Failed to create rule.');
    });
  });
});
