import { Mock, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryType } from '@models/category.model';
import { CategoryFilter, NO_FILTER } from '../../utils/category-helpers';
import { CategoryFiltersComponent } from './category-filters.component';

describe('CategoryFiltersComponent', () => {
  let fixture: ComponentFixture<CategoryFiltersComponent>;
  let component: CategoryFiltersComponent;
  let changes: Mock<(filter: CategoryFilter) => void>;

  function render(
    filter: CategoryFilter = NO_FILTER,
    types = [CategoryType.EXPENSE, CategoryType.INCOME],
  ): void {
    fixture.componentRef.setInput('filter', filter);
    fixture.componentRef.setInput('types', types);
    fixture.componentRef.setInput('unusedCount', 3);
    fixture.detectChanges();
  }
  const pill = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith(name),
    );
  const search = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('input[aria-label="Search categories"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryFiltersComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryFiltersComponent);
    component = fixture.componentInstance;
    changes = vi.fn<(filter: CategoryFilter) => void>();
    component.filterChange.subscribe(changes);
  });

  it('should mark the active type pill pressed', () => {
    // act
    render({ ...NO_FILTER, type: CategoryType.INCOME });

    // assert & verify
    expect(pill('Income')?.getAttribute('aria-pressed')).toBe('true');
    expect(pill('All')?.getAttribute('aria-pressed')).toBe('false');
    expect(pill('Expense')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should emit the full filter when a type pill is chosen, keeping search and unusedOnly', () => {
    // arrange
    render({ type: 'ALL', unusedOnly: true, search: 'fo' });

    // act
    pill('Expense')?.click();

    // assert & verify
    expect(changes).toHaveBeenCalledWith({
      type: CategoryType.EXPENSE,
      unusedOnly: true,
      search: 'fo',
    });
  });

  it('should toggle unusedOnly from the Unused pill and show its count', () => {
    // arrange
    render();

    // act
    pill('Unused')?.click();

    // assert & verify
    expect(pill('Unused')?.textContent).toContain('3');
    expect(changes).toHaveBeenCalledWith({ ...NO_FILTER, unusedOnly: true });

    // act
    render({ ...NO_FILTER, unusedOnly: true });
    pill('Unused')?.click();

    // assert & verify
    expect(pill('Unused')?.getAttribute('aria-pressed')).toBe('true');
    expect(changes).toHaveBeenLastCalledWith(NO_FILTER);
  });

  it('should emit the typed search text', () => {
    // arrange
    render();

    // act
    search().value = 'groc';
    search().dispatchEvent(new Event('input'));

    // assert & verify
    expect(changes).toHaveBeenCalledWith({ ...NO_FILTER, search: 'groc' });
  });

  it('should only offer the types it is given', () => {
    // act
    render(NO_FILTER, [CategoryType.EXPENSE, CategoryType.INCOME, CategoryType.TRANSFER]);

    // assert & verify
    expect(pill('Transfer')).toBeTruthy();
    expect(pill('Both')).toBeUndefined();
  });
});
