import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';

import {CategoryRuleFormDialogComponent} from './category-rule-form-dialog.component';
import {CategoryRuleApiService} from '../../services/category-rule-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {Category} from '@models/category.model';

describe('CategoryRuleFormDialogComponent', () => {
  let component: CategoryRuleFormDialogComponent;
  let fixture: ComponentFixture<CategoryRuleFormDialogComponent>;
  let mockRuleApi: any;
  let mockCategoryApi: any;
  let mockToast: any;

  const mockCategory: Category = {id: 50, userId: 1, name: 'Shopping'} as unknown as Category;

  beforeEach(async () => {
    mockRuleApi = {createRule: vi.fn().mockReturnValue(of(1))};
    mockCategoryApi = {getGroupedCategories: vi.fn().mockReturnValue(of([]))};
    mockToast = {success: vi.fn(), error: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [CategoryRuleFormDialogComponent, NoopAnimationsModule],
      providers: [
        {provide: CategoryRuleApiService, useValue: mockRuleApi},
        {provide: CategoryApiService, useValue: mockCategoryApi},
        {provide: ToastService, useValue: mockToast}
      ]
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
      expect.objectContaining({keywords: ['AMZN', 'MKTP', 'US']})
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
      expect.objectContaining({keywords: ['WALMART'], matchType: 'OR'})
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
      expect.objectContaining({matchType: 'AND'})
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
});
