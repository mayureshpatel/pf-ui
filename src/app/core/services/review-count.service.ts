import { DestroyRef, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DashboardApiService } from '@features/dashboard/services/dashboard-api.service';
import { ActionItem, ActionType } from '@models/dashboard.model';

/**
 * The number of uncategorized expenses waiting for review (PF-947), shared so the navigation can
 * show it without every screen fetching it again. The shell loads it once; the Transactions
 * screen, which already reloads its review counts after a change, pushes the new figure here.
 */
@Injectable({ providedIn: 'root' })
export class ReviewCountService {
  private readonly dashboardApi: DashboardApiService = inject(DashboardApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly count: WritableSignal<number> = signal(0);

  /** Uncategorized expenses to review; zero when there are none or the load failed. */
  readonly uncategorized: Signal<number> = this.count.asReadonly();

  /** Loads the count. A failure leaves it at zero, since the badge is a convenience. */
  refresh(): void {
    this.dashboardApi
      .getActionItems()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: ActionItem[]): void =>
          this.count.set(
            items.find((i: ActionItem): boolean => i.type === ActionType.UNCATEGORIZED)?.count ?? 0,
          ),
        error: (): void => this.count.set(0),
      });
  }

  /** Takes a count another screen has just loaded, so the badge need not fetch again. */
  set(count: number): void {
    this.count.set(Math.max(0, count));
  }
}
