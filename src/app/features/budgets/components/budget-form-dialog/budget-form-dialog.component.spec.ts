import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { InputNumber } from 'primeng/inputnumber';
import { BudgetFormDialogComponent } from './budget-form-dialog.component';
import { BudgetApiService } from '../../services/budget-api.service';
import { ToastService } from '@core/services/toast.service';
import { Category, CategoryType } from '@models/category.model';

describe('BudgetFormDialogComponent', () => {
  let component: BudgetFormDialogComponent;
  let fixture: ComponentFixture<BudgetFormDialogComponent>;
  let mockBudgetApi: any;
  let mockToast: any;

  const rent = {
    id: 1,
    userId: 1,
    name: 'Rent',
    type: CategoryType.EXPENSE,
    parent: null,
    icon: '',
    color: '',
  } as Category;
  const subscriptions = {
    id: 2,
    userId: 1,
    name: 'Subscriptions',
    type: CategoryType.EXPENSE,
    parent: rent,
    icon: '',
    color: '',
  } as Category;
  const mockCategories: Category[] = [rent, subscriptions];

  beforeEach(async () => {
    mockBudgetApi = { createBudget: vi.fn().mockReturnValue(of({})) };
    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BudgetFormDialogComponent],
      providers: [
        { provide: BudgetApiService, useValue: mockBudgetApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('categories', mockCategories);
    fixture.componentRef.setInput('month', 3);
    fixture.componentRef.setInput('year', 2026);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('categoryGroups', () => {
    it('should group parent categories under "Main Categories"', () => {
      expect(component.categoryGroups()[0]).toEqual({
        label: 'Main Categories',
        items: [{ label: 'Rent', value: 1 }],
      });
    });

    it("should group a parent's children under '<Parent> (Sub-categories)'", () => {
      expect(component.categoryGroups()[1]).toEqual({
        label: 'Rent (Sub-categories)',
        items: [{ label: 'Subscriptions', value: 2 }],
      });
    });

    it('should omit a sub-categories group for a parent with no children', () => {
      fixture.componentRef.setInput('categories', [rent]);
      fixture.detectChanges();

      expect(component.categoryGroups()).toEqual([
        { label: 'Main Categories', items: [{ label: 'Rent', value: 1 }] },
      ]);
    });
  });

  describe('form validation', () => {
    it('should be invalid with no category or amount selected', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should reject a negative amount', () => {
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(-5);

      expect(component.form.controls.amount.invalid).toBe(true);
    });

    it('should accept a zero amount', () => {
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(0);

      expect(component.form.valid).toBe(true);
    });

    it('should not call the API and should touch all controls when submitted while invalid', () => {
      component.onSubmit();

      expect(mockBudgetApi.createBudget).not.toHaveBeenCalled();
      expect(component.form.controls.categoryId.touched).toBe(true);
      expect(component.form.controls.amount.touched).toBe(true);
    });
  });

  describe('onSubmit (create/upsert)', () => {
    // The template's own copy states the intent directly: "If a budget already exists for this
    // category and period, it will be updated." Create vs. update is an upsert decided entirely
    // server-side by (category, month, year) uniqueness -- there is no separate frontend edit
    // mode, prefill path, or second API method; the same createBudget() call covers both.
    it('should call createBudget with the form values and the month/year inputs on success', () => {
      // arrange
      component.form.controls.categoryId.setValue(2);
      component.form.controls.amount.setValue(150);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockBudgetApi.createBudget).toHaveBeenCalledWith(2, 150, 3, 2026);
    });

    it('should toast success, emit save, and close the dialog once the API call resolves', () => {
      // arrange
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(500);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Budget saved successfully');
      expect(saveSpy).toHaveBeenCalled();
      expect(component.visible()).toBe(false);
    });

    it('should reject submission when the selected category is no longer in the input list', () => {
      // arrange -- categoryId set directly, bypassing the dropdown's own option list
      component.form.controls.categoryId.setValue(999);
      component.form.controls.amount.setValue(100);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockBudgetApi.createBudget).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('Selected category is no longer valid.');
    });

    it('should surface the API error message and leave the dialog open on failure', () => {
      // arrange
      mockBudgetApi.createBudget.mockReturnValue(
        throwError(() => ({ error: { detail: 'Budget already locked' } })),
      );
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(200);

      // act
      component.onSubmit();

      // assert & verify
      expect(component.errorMessage()).toBe('Budget already locked');
      expect(component.loading()).toBe(false);
      expect(component.visible()).toBe(true);
    });

    it('should fall back to a generic error message when the API error has no detail', () => {
      // arrange
      mockBudgetApi.createBudget.mockReturnValue(throwError(() => ({ error: {} })));
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(200);

      // act
      component.onSubmit();

      // assert & verify
      expect(component.errorMessage()).toBe('Failed to save budget. Please try again.');
    });

    it('should ignore a resubmit while a save is already in flight', () => {
      // arrange -- a call that never resolves, to hold the component in a loading state
      mockBudgetApi.createBudget.mockReturnValue(of({}));
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(200);
      component.loading.set(true);

      // act
      component.onSubmit();

      // assert & verify
      expect(mockBudgetApi.createBudget).not.toHaveBeenCalled();
    });
  });

  describe('onShow', () => {
    it('should reset the form and clear any previous error message', () => {
      // arrange
      component.form.controls.categoryId.setValue(1);
      component.form.controls.amount.setValue(200);
      component.errorMessage.set('some stale error');

      // act
      component.onShow();

      // assert & verify
      expect(component.form.controls.categoryId.value).toBeNull();
      expect(component.form.controls.amount.value).toBeNull();
      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('rendering', () => {
    it('should autofocus the amount input', () => {
      // act
      const inputNumber = fixture.debugElement.query(By.directive(InputNumber));

      // assert & verify
      expect(inputNumber.componentInstance.autofocus).toBe(true);
    });

    it('should display the API error message when present', () => {
      // arrange & act
      component.errorMessage.set('Something went wrong');
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('Something went wrong');
    });
  });
});
