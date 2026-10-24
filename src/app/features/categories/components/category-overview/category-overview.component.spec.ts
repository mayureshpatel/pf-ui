import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryStats } from '../../utils/category-helpers';
import { CategoryOverviewComponent } from './category-overview.component';

describe('CategoryOverviewComponent', () => {
  let fixture: ComponentFixture<CategoryOverviewComponent>;
  let component: CategoryOverviewComponent;
  const render = (stats: CategoryStats): void => {
    fixture.componentRef.setInput('stats', stats);
    fixture.detectChanges();
  };
  const text = (): string => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryOverviewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should show the category, group and transaction totals', () => {
    // act
    render({ categories: 9, groups: 4, transactions: 1234, unused: 0 });

    // assert & verify
    expect(text()).toContain('9 categories in 4 groups');
    expect(text()).toContain('1,234 transactions');
  });

  it('should use singular wording for one category, one group and one transaction', () => {
    // act
    render({ categories: 1, groups: 1, transactions: 1, unused: 1 });

    // assert & verify
    expect(text()).toContain('1 category in 1 group');
    expect(text()).toContain('1 transaction');
    expect(text()).toContain('1 category has no transactions');
  });

  it('should offer Review unused only when some are unused, and emit reviewUnused', () => {
    // arrange
    render({ categories: 9, groups: 4, transactions: 10, unused: 0 });
    // assert & verify
    expect(button('Review unused categories')).toBeUndefined();
    expect(fixture.nativeElement.querySelector('[data-testid="unused-line"]')).toBeNull();

    // arrange
    render({ categories: 9, groups: 4, transactions: 10, unused: 3 });
    const reviewed = vi.fn();
    component.reviewUnused.subscribe(reviewed);

    // act
    button('Review unused categories')?.click();

    // assert & verify
    expect(
      fixture.nativeElement.querySelector('[data-testid="unused-line"]').textContent,
    ).toContain('3 categories have no transactions');
    expect(reviewed).toHaveBeenCalledTimes(1);
  });

  it('should emit add', () => {
    // arrange
    render({ categories: 1, groups: 1, transactions: 0, unused: 0 });
    const added = vi.fn();
    component.add.subscribe(added);

    // act
    button('Add category')?.click();

    // assert & verify
    expect(added).toHaveBeenCalledTimes(1);
  });
});
