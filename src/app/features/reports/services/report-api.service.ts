import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { NetWorthDataPoint } from '../models/reports.model';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';

const SKIP_TOAST_CONTEXT = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

/**
 * Client for the backend's dedicated report endpoints (`ReportController`, PF-304+) -- distinct
 * from `ReportsDataService`, which aggregates an already-loaded transaction dataset client-side
 * for the other sub-reports.
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
}
