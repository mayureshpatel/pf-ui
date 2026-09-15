import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { skip } from 'rxjs';
import { TabsModule } from 'primeng/tabs';

import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { DateRangeFilterComponent } from './components/date-range-filter/date-range-filter.component';
import { CategoryReportComponent } from './components/category-report/category-report.component';
import { MerchantReportComponent } from './components/merchant-report/merchant-report.component';
import { IncomeExpenseReportComponent } from './components/income-expense-report/income-expense-report.component';
import { NetWorthReportComponent } from './components/net-worth-report/net-worth-report.component';
import { DateRange } from './models/reports.model';
import { toLocalDateString } from '@shared/utils/transaction.utils';

/**
 * Main reporting hub providing visual analytics and deep-dive spending patterns.
 *
 * Owns only the selected date range and its URL sync; each tab (PF-823) owns its own server-side
 * aggregated fetch keyed off that range, rather than this component centrally fetching a raw,
 * page-capped transaction array for every tab to aggregate client-side -- the old approach could
 * silently understate totals past 1000 matching transactions in the selected range.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    ScreenToolbarComponent,
    DateRangeFilterComponent,
    CategoryReportComponent,
    MerchantReportComponent,
    IncomeExpenseReportComponent,
    NetWorthReportComponent,
  ],
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnInit {
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  /** The currently active date range for the reports. */
  readonly dateRange: WritableSignal<DateRange> = signal(this.getDefaultDateRange());

  /** Currently selected tab (0: Category, 1: Merchant, 2: Monthly, 3: Net Worth). */
  readonly activeTabIndex: WritableSignal<number> = signal(0);

  constructor() {
    /** Keeps the URL in sync whenever the user changes the global date range filters. */
    effect((): void => {
      this.updateUrlParams(this.dateRange());
    });
  }

  /**
   * Hydrates the date range from URL query params on load, then keeps it in sync with later
   * external navigation (e.g. browser back/forward), so the selection survives a refresh and is
   * shareable as a link.
   */
  ngOnInit(): void {
    this.hydrateFromParams(this.route.snapshot.queryParams);

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.hydrateFromParams(params));
  }

  /**
   * Translates URL query params into the date-range signal, only writing when the parsed value
   * actually differs from the current one -- avoids re-triggering the sync effect for a URL
   * change that just echoes the state that produced it.
   */
  private hydrateFromParams(params: Params): void {
    const startDate: string | undefined = params['startDate'];
    const endDate: string | undefined = params['endDate'];
    if (!startDate || !endDate) {
      return;
    }

    const current: DateRange = this.dateRange();
    if (startDate !== current.startDate || endDate !== current.endDate) {
      this.dateRange.set({ startDate, endDate, label: params['label'] || 'Custom Range' });
    }
  }

  /**
   * Serializes the current date range to URL query params. Always written (never omitted as a
   * "default"), since reports always has some active range -- unlike transactions' filters, there's
   * no meaningful "no range selected" state to treat as elidable.
   */
  private updateUrlParams(range: DateRange): void {
    this.router.navigate([], {
      queryParams: { startDate: range.startDate, endDate: range.endDate, label: range.label },
      queryParamsHandling: 'replace',
      replaceUrl: true,
    });
  }

  /**
   * Generates the default report period (Last 3 Months).
   * @returns A pre-populated DateRange object.
   */
  private getDefaultDateRange(): DateRange {
    const end: Date = new Date();
    const start: Date = new Date();
    start.setMonth(start.getMonth() - 3);

    return {
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
      label: 'Last 3 Months',
    };
  }
}
