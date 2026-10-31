import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TRANSACTIONS_TABPANEL_ID,
  TransactionReviewTabsComponent,
} from './transaction-review-tabs.component';

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

  // PF-868: the WAI-ARIA tabs pattern
  describe('tabs pattern', () => {
    const tabs = (): HTMLButtonElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    const press = (key: string, from: HTMLElement): void => {
      from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    it('should keep only the active tab in the tab order', () => {
      // act
      render({ activeTab: 'ALL', uncategorizedCount: 5, transferCount: 0 });

      // assert & verify
      expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1']);
    });

    it('should move the tab stop with the active tab', () => {
      // act
      render({ activeTab: 'NEEDS_CATEGORY', uncategorizedCount: 5, transferCount: 0 });

      // assert & verify
      expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0']);
    });

    it('should select and focus the next tab on ArrowRight, and wrap round', () => {
      // arrange
      render({ activeTab: 'ALL', uncategorizedCount: 5, transferCount: 0 });
      const changed = vi.fn();
      fixture.componentInstance.tabChange.subscribe(changed);

      // act
      press('ArrowRight', tabs()[0]);

      // assert & verify
      expect(changed).toHaveBeenLastCalledWith('NEEDS_CATEGORY');
      expect(document.activeElement).toBe(tabs()[1]);

      // act -- from the last tab it wraps to the first
      render({ activeTab: 'NEEDS_CATEGORY', uncategorizedCount: 5, transferCount: 0 });
      press('ArrowRight', tabs()[1]);

      // assert & verify
      expect(changed).toHaveBeenLastCalledWith('ALL');
    });

    it('should select the previous tab on ArrowLeft, and the first and last on Home and End', () => {
      // arrange
      render({ activeTab: 'ALL', uncategorizedCount: 5, transferCount: 0 });
      const changed = vi.fn();
      fixture.componentInstance.tabChange.subscribe(changed);

      // act & assert
      press('ArrowLeft', tabs()[0]);
      expect(changed).toHaveBeenLastCalledWith('NEEDS_CATEGORY');
      press('End', tabs()[0]);
      expect(changed).toHaveBeenLastCalledWith('NEEDS_CATEGORY');
      // the host applies the selection, so the next key press starts from the new active tab
      render({ activeTab: 'NEEDS_CATEGORY', uncategorizedCount: 5, transferCount: 0 });
      press('Home', tabs()[1]);
      expect(changed).toHaveBeenLastCalledWith('ALL');
    });

    it('should do nothing on an arrow key when there is only one tab', () => {
      // arrange
      render({ activeTab: 'ALL', uncategorizedCount: 0, transferCount: 0 });
      const changed = vi.fn();
      fixture.componentInstance.tabChange.subscribe(changed);

      // act
      press('ArrowRight', tabs()[0]);

      // assert & verify
      expect(changed).not.toHaveBeenCalled();
    });

    it('should give each tab an id and point aria-controls at the shared panel', () => {
      // act
      render({ activeTab: 'ALL', uncategorizedCount: 5, transferCount: 0 });

      // assert & verify
      expect(tabs().map((t) => t.id)).toEqual([
        'transaction-tab-all',
        'transaction-tab-needs-category',
      ]);
      for (const t of tabs()) {
        expect(t.getAttribute('aria-controls')).toBe(TRANSACTIONS_TABPANEL_ID);
      }
    });
  });

  it('should give the Needs a category count badge at least 4.5:1 text contrast (amber-700 or darker)', () => {
    // act
    render({ activeTab: 'ALL', uncategorizedCount: 5, transferCount: 0 });

    // assert & verify -- white text; amber-600 is about 3.2:1, amber-700 is about 5:1
    const badge = tab(/Needs a category/)?.querySelector('span') as HTMLElement;
    expect(badge.classList.contains('text-white')).toBe(true);
    expect(badge.classList.contains('bg-amber-700')).toBe(true);
    expect(badge.classList.contains('bg-amber-600')).toBe(false);
  });
});
