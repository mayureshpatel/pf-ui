import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionReviewTabsComponent } from './transaction-review-tabs.component';

describe('TransactionReviewTabsComponent', () => {
  let fixture: ComponentFixture<TransactionReviewTabsComponent>;

  function render(inputs: {
    activeTab: 'ALL' | 'NEEDS_CATEGORY';
    uncategorizedCount: number;
    transferCount: number;
  }): void {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  const tab = (name: RegExp): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      name.test((b.textContent ?? '').trim()),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionReviewTabsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionReviewTabsComponent);
  });

  it('should show All, Needs a category with its count, and the transfers entry with its count', () => {
    // act
    render({ activeTab: 'ALL', uncategorizedCount: 2594, transferCount: 96 });

    // assert & verify
    expect(tab(/^All/)).toBeTruthy();
    expect(tab(/Needs a category/)?.textContent).toContain('2,594');
    expect(tab(/possible transfers/i)?.textContent).toContain('96');
  });

  it('should mark the active tab with aria-selected', () => {
    // act
    render({ activeTab: 'NEEDS_CATEGORY', uncategorizedCount: 5, transferCount: 0 });

    // assert & verify
    expect(tab(/Needs a category/)?.getAttribute('aria-selected')).toBe('true');
    expect(tab(/^All/)?.getAttribute('aria-selected')).toBe('false');
  });

  it('should emit the chosen tab', () => {
    // arrange
    render({ activeTab: 'ALL', uncategorizedCount: 5, transferCount: 0 });
    const emitted = vi.fn();
    fixture.componentInstance.tabChange.subscribe(emitted);

    // act
    tab(/Needs a category/)?.click();

    // assert & verify
    expect(emitted).toHaveBeenCalledWith('NEEDS_CATEGORY');
  });

  it('should emit reviewTransfers from the amber entry', () => {
    // arrange
    render({ activeTab: 'ALL', uncategorizedCount: 0, transferCount: 3 });
    const emitted = vi.fn();
    fixture.componentInstance.reviewTransfers.subscribe(emitted);

    // act
    tab(/possible transfers/i)?.click();

    // assert & verify
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('should hide zero counts, and keep Needs a category visible while it is the active tab', () => {
    // act
    render({ activeTab: 'ALL', uncategorizedCount: 0, transferCount: 0 });

    // assert & verify
    expect(tab(/Needs a category/)).toBeUndefined();
    expect(tab(/possible transfers/i)).toBeUndefined();

    // act
    render({ activeTab: 'NEEDS_CATEGORY', uncategorizedCount: 0, transferCount: 0 });

    // assert & verify
    expect(tab(/Needs a category/)).toBeTruthy();
    expect(tab(/Needs a category/)?.textContent).not.toMatch(/\d/);
  });
});
