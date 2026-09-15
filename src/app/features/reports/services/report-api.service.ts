import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import {
  CategoryReportData,
  MerchantReportData,
  MonthlyReportData,
  NetWorthDataPoint,
} from '../models/reports.model';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { Category } from '@models/category.model';

const SKIP_TOAST_CONTEXT = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

/**
 * Raw shape of a `/reports/categories` row, matching `CategoryReportDataDto` field-for-field.
 * `category` is never null -- the backing query only ever includes categorized transactions,
 * matching the old client-side aggregateByCategory()'s own `&& txn.category` check.
 */
interface CategoryReportDataResponse {
  category: Category;
  total: number;
  count: number;
}

/** Raw shape of a `/reports/monthly` row, matching `MonthlyReportDataDto` field-for-field. */
interface MonthlyReportDataResponse {
  year: number;
  month: number;
  income: number;
  expense: number;
}

/**
 * Client for the backend's dedicated report endpoints (`ReportController`, PF-304+). Categories,
 * Merchants, and Cash Flow are all aggregated server-side (PF-823) -- no row cap, unlike the old
 * client-side aggregation approach this replaced.
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
   * Gets the Categories tab's spending breakdown for the given range, aggregated server-side over
   * every matching transaction.
   * @param startDate the first date to include (ISO date, inclusive)
   * @param endDate the last date to include (ISO date, inclusive)
   * @returns one entry per category with spend in range, highest total first
   */
  getCategoryBreakdown(startDate: string, endDate: string): Observable<CategoryReportData[]> {
    const params: HttpParams = new HttpParams().set('startDate', startDate).set('endDate', endDate);

    return this.http
      .get<CategoryReportDataResponse[]>(`${this.apiUrl}/categories`, {
        params,
        context: SKIP_TOAST_CONTEXT,
      })
      .pipe(
        map((rows: CategoryReportDataResponse[]): CategoryReportData[] =>
          rows.map(
            (row: CategoryReportDataResponse): CategoryReportData => ({
              category: row.category,
              total: row.total,
              count: row.count,
              avgTransaction: row.count > 0 ? row.total / row.count : 0,
            }),
          ),
        ),
      );
  }

  /**
   * Gets the Merchants tab's spending breakdown for the given range, aggregated server-side over
   * every matching transaction.
   * @param startDate the first date to include (ISO date, inclusive)
   * @param endDate the last date to include (ISO date, inclusive)
   * @returns one entry per merchant with spend in range, highest total first
   */
  getMerchantBreakdown(startDate: string, endDate: string): Observable<MerchantReportData[]> {
    const params: HttpParams = new HttpParams().set('startDate', startDate).set('endDate', endDate);

    return this.http.get<MerchantReportData[]>(`${this.apiUrl}/merchants`, {
      params,
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Gets the Cash Flow tab's monthly income/expense breakdown for the given range, aggregated
   * server-side over every matching transaction.
   * @param startDate the first date to include (ISO date, inclusive)
   * @param endDate the last date to include (ISO date, inclusive)
   * @returns one entry per month with matching activity, oldest first
   */
  getMonthlyBreakdown(startDate: string, endDate: string): Observable<MonthlyReportData[]> {
    const params: HttpParams = new HttpParams().set('startDate', startDate).set('endDate', endDate);

    return this.http
      .get<MonthlyReportDataResponse[]>(`${this.apiUrl}/monthly`, {
        params,
        context: SKIP_TOAST_CONTEXT,
      })
      .pipe(
        map((rows: MonthlyReportDataResponse[]): MonthlyReportData[] =>
          rows.map(
            (row: MonthlyReportDataResponse): MonthlyReportData => ({
              month: `${row.year}-${String(row.month).padStart(2, '0')}`,
              income: row.income,
              expense: row.expense,
              netSavings: row.income - row.expense,
            }),
          ),
        ),
      );
  }
}
