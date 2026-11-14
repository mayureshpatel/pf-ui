import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ReviewCountService } from './review-count.service';
import { DashboardApiService } from '@features/dashboard/services/dashboard-api.service';
import { ActionItem, ActionType } from '@models/dashboard.model';

describe('ReviewCountService', () => {
  let getActionItems: ReturnType<typeof vi.fn>;
  let service: ReviewCountService;

  const item = (type: ActionType, count: number): ActionItem => ({ type, count, message: '' });

  beforeEach(() => {
    getActionItems = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DashboardApiService, useValue: { getActionItems } }],
    });
    service = TestBed.inject(ReviewCountService);
  });

  it('starts at zero', () => {
    expect(service.uncategorized()).toBe(0);
  });

  it('reads the uncategorized count from the action items', () => {
    getActionItems.mockReturnValue(
      of([item(ActionType.TRANSFER_REVIEW, 4), item(ActionType.UNCATEGORIZED, 7)]),
    );

    service.refresh();

    expect(service.uncategorized()).toBe(7);
  });

  it('is zero when there is no uncategorized item', () => {
    getActionItems.mockReturnValue(of([item(ActionType.STALE_DATA, 2)]));

    service.refresh();

    expect(service.uncategorized()).toBe(0);
  });

  it('falls back to zero when the load fails', () => {
    service.set(5);
    getActionItems.mockReturnValue(throwError(() => new Error('down')));

    service.refresh();

    expect(service.uncategorized()).toBe(0);
  });

  it('takes a count pushed by another screen and never goes negative', () => {
    service.set(12);
    expect(service.uncategorized()).toBe(12);

    service.set(-3);
    expect(service.uncategorized()).toBe(0);
  });
});
