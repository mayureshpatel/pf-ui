import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {ConfirmationService} from 'primeng/api';

import {CategoryRulesComponent} from './category-rules.component';
import {CategoryRuleApiService} from './services/category-rule-api.service';
import {ToastService} from '@core/services/toast.service';
import {CategoryRule} from '@models/category-rule.model';

describe('CategoryRulesComponent', () => {
  let component: CategoryRulesComponent;
  let fixture: ComponentFixture<CategoryRulesComponent>;
  let mockApi: any;
  let mockToast: any;
  let mockConfirmationService: any;

  // a rule left pointing at a category that no longer exists (PF-191): the backend's
  // left join returns a null category for it, so the row mapper produces `category: null`
  const orphanedRule: CategoryRule = {
    id: 1,
    userId: 1,
    keywords: ['STARBUCKS'],
    matchType: 'OR',
    priority: 1,
    category: null,
    minAmount: null,
    maxAmount: null
  } as unknown as CategoryRule;

  beforeEach(async () => {
    mockApi = {
      getRules: vi.fn().mockReturnValue(of([orphanedRule])),
      previewApply: vi.fn().mockReturnValue(of([])),
      applyRules: vi.fn().mockReturnValue(of(undefined)),
      deleteRule: vi.fn().mockReturnValue(of(undefined))
    };
    mockToast = {success: vi.fn(), error: vi.fn(), info: vi.fn()};
    mockConfirmationService = {confirm: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [CategoryRulesComponent, NoopAnimationsModule],
      providers: [
        {provide: CategoryRuleApiService, useValue: mockApi},
        {provide: ToastService, useValue: mockToast},
        {provide: ConfirmationService, useValue: mockConfirmationService}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryRulesComponent);
    component = fixture.componentInstance;
  });

  it('should render a rule with no associated category without throwing (PF-191)', () => {
    // act & assert & verify
    expect(() => fixture.detectChanges()).not.toThrow();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Uncategorized');
  });

  it('should give the delete button an accessible name (PF-186)', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-trash)');
    expect(button.getAttribute('aria-label')).toBe('Permanently remove this rule');
  });

  it('PF-314: should display a rule\'s amount range when set, and "Any amount" when not', () => {
    // arrange
    const rangedRule: CategoryRule = {
      id: 2,
      userId: 1,
      keywords: ['AMAZON'],
      matchType: 'OR',
      priority: 1,
      category: null,
      minAmount: 5,
      maxAmount: 20
    } as unknown as CategoryRule;
    mockApi.getRules.mockReturnValue(of([orphanedRule, rangedRule]));

    // act
    fixture.detectChanges();

    // assert & verify
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Any amount');
    expect(compiled.textContent).toContain('$5.00');
    expect(compiled.textContent).toContain('$20.00');
  });

  it('PF-315: should display every keyword of a multi-keyword rule, joined by its match type', () => {
    // arrange
    const multiKeywordRule: CategoryRule = {
      id: 3,
      userId: 1,
      keywords: ['AMZN', 'MKTP'],
      matchType: 'AND',
      priority: 1,
      category: null,
      minAmount: null,
      maxAmount: null
    } as unknown as CategoryRule;
    mockApi.getRules.mockReturnValue(of([multiKeywordRule]));

    // act
    fixture.detectChanges();

    // assert & verify
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('AMZN');
    expect(compiled.textContent).toContain('MKTP');
    expect(compiled.textContent).toContain('AND');
  });
});
