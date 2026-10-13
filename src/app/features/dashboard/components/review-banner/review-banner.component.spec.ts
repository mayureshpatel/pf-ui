import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActionItem, ActionType } from '@models/dashboard.model';
import { ReviewBannerComponent } from './review-banner.component';

describe('ReviewBannerComponent', () => {
  let fixture: ComponentFixture<ReviewBannerComponent>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  function render(items: ActionItem[]): void {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  beforeEach(async () => {
    navigateByUrl = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ReviewBannerComponent],
      providers: [{ provide: Router, useValue: { navigateByUrl } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ReviewBannerComponent);
  });

  it('should render nothing when there are no items', () => {
    // act
    render([]);

    // assert & verify
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    expect(buttons().length).toBe(0);
  });

  it('should render one native button per item with a count and noun', () => {
    // act
    render([
      {
        type: ActionType.TRANSFER_REVIEW,
        count: 12,
        message: '12 potential transfers found',
        route: '/transactions?action=review-transfers',
      },
      {
        type: ActionType.UNCATEGORIZED,
        count: 7,
        message: 'Uncategorized expenses found',
        route: '/transactions?categoryName=null',
      },
    ]);

    // assert & verify
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      '12 possible transfers',
      '7 uncategorized expenses',
    ]);
  });

  it('should use the singular noun for a count of one', () => {
    // act
    render([{ type: ActionType.UNCATEGORIZED, count: 1, message: 'Uncategorized expenses found' }]);

    // assert & verify
    expect(buttons()[0].textContent?.trim()).toBe('1 uncategorized expense');
  });

  it('should fall back to the server message when the count is zero', () => {
    // act
    render([{ type: ActionType.STALE_DATA, count: 0, message: 'Bank data is out of date' }]);

    // assert & verify
    expect(buttons()[0].textContent?.trim()).toBe('Bank data is out of date');
  });

  it('should navigate to the item route, query string included, on click', () => {
    // arrange
    render([
      {
        type: ActionType.UNCATEGORIZED,
        count: 7,
        message: 'x',
        route: '/transactions?categoryName=null',
      },
    ]);

    // act
    buttons()[0].click();

    // assert & verify
    expect(navigateByUrl).toHaveBeenCalledWith('/transactions?categoryName=null');
  });

  it('should not navigate when an item has no route', () => {
    // arrange
    render([{ type: ActionType.STALE_DATA, count: 2, message: 'x' }]);

    // act
    buttons()[0].click();

    // assert & verify
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('should label the region for assistive technology', () => {
    // act
    render([{ type: ActionType.UNCATEGORIZED, count: 3, message: 'x' }]);

    // assert & verify
    expect(fixture.nativeElement.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Needs your review',
    );
  });
});
