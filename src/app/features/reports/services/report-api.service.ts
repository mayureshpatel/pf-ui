import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  ExploreResult,
  NetWorthBreakdown,
  ExploreState,
  ExploreTransaction,
  ExploreTrend,
  NetWorthDataPoint,
} from '../models/reports.model';
import { PageResponse } from '@models/transaction.model';
import { toApiParams } from '../utils/explore-state';
import { NetWorthState, toBreakdownParams } from '../utils/net-worth-state';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';

const SKIP_TOAST_CONTEXT = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

/**
 * Client for the backend's report endpoints (`ReportController`): the explorer's groups, trend and
 * transactions (PF-886), all aggregated server-side with no row cap, and the net worth series.
 */
@Injectable({
  providedIn: 'root',
})
export class ReportApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/reports`;

  /**
   * Gets the net-worth-over-time series from the backend.
   * @param startDate the period start (ISO date); the backend defaults to a trailing 12 months if omitted.
   * @param endDate the period end (ISO date); the backend defaults to today if omitted.
   * @returns the net worth data points, one per month-end in range.
   */
  getNetWorth(startDate?: string, endDate?: string): Observable<NetWorthDataPoint[]> {
    let params: HttpParams = new HttpParams();
    if (startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    }

    return this.http.get<NetWorthDataPoint[]>(`${this.apiUrl}/net-worth`, {
      params,
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Gets the net worth view in one response: month-end assets, debts and net worth, the rows by account
   * type or account, the cards' figures, what moved net worth, and the comparison if asked.
   * @param state the net worth view's state
   * @returns the whole breakdown
   */
  getNetWorthBreakdown(state: NetWorthState): Observable<NetWorthBreakdown> {
    return this.http.get<NetWorthBreakdown>(`${this.apiUrl}/net-worth/breakdown`, {
      params: new HttpParams({ fromObject: toBreakdownParams(state) }),
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Runs the explorer: the measure by the grouping under the filters, with the comparison if asked.
   * @param state the explorer state
   * @returns the groups, totals and comparison
   */
  explore(state: ExploreState): Observable<ExploreResult> {
    return this.http.get<ExploreResult>(`${this.apiUrl}/explore`, {
      params: new HttpParams({ fromObject: toApiParams(state) }),
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Gets the measure per day, week or month across the period, under the same filters.
   * @param state the explorer state
   * @returns the current buckets and the comparison buckets
   */
  trend(state: ExploreState): Observable<ExploreTrend> {
    const params: Record<string, string> = toApiParams(state);
    delete params['groupBy'];
    return this.http.get<ExploreTrend>(`${this.apiUrl}/explore/trend`, {
      params: new HttpParams({ fromObject: params }),
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Gets a page of the transactions behind the number, newest first.
   * @param state the explorer state
   * @param page the zero-based page
   * @param size the page size (the server caps it at 100)
   * @returns the page of transactions
   */
  transactions(
    state: ExploreState,
    page: number,
    size: number,
  ): Observable<PageResponse<ExploreTransaction>> {
    const params: Record<string, string> = toApiParams(state);
    delete params['groupBy'];
    delete params['compare'];
    return this.http.get<PageResponse<ExploreTransaction>>(`${this.apiUrl}/explore/transactions`, {
      params: new HttpParams({ fromObject: { ...params, page: String(page), size: String(size) } }),
      context: SKIP_TOAST_CONTEXT,
    });
  }
}
