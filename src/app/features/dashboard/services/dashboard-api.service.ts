import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {
  ActionItem,
  CashFlowTrend,
  CategoryTotal,
  DashboardPulse,
  MerchantBreakdown,
  YtdSummary
} from '@models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/dashboard`;

  /**
   * Get the category breakdown data from the backend.
   * <br><br>
   * This endpoint can be called with either month/year or startDate/endDate parameters.
   * If both are provided, month/year will be ignored.
   * @param month the period month
   * @param year the period year
   * @param startDate the period start
   * @param endDate the period end
   * @returns the category breakdown data.
   */
  getCategoryBreakdown(month?: number, year?: number, startDate?: string, endDate?: string): Observable<CategoryTotal[]> {
    return this.http.get<CategoryTotal[]>(
      `${this.apiUrl}/categories`,
      {
        params: this.getPeriodHttpParams(month, year, startDate, endDate),
      });
  }

  /**
   * Get the merchant breakdown data from the backend.
   * <br><br>
   * This endpoint can be called with either month/year or startDate/endDate parameters.
   * If both are provided, month/year will be ignored.
   * @param month the period month
   * @param year the period year
   * @param startDate the period start date
   * @param endDate the period end date
   * @returns the merchant breakdown data.
   */
  getVendorBreakdown(month?: number, year?: number, startDate?: string, endDate?: string): Observable<MerchantBreakdown[]> {
    return this.http.get<MerchantBreakdown[]>(
      `${this.apiUrl}/merchants`,
      {
        params: this.getPeriodHttpParams(month, year, startDate, endDate)
      });
  }

  /**
   * Gets the pulse data from the backend.
   * <br><br>
   * This endpoint can be called with either month/year or startDate/endDate parameters.
   * If both are provided, month/year will be ignored.
   </br></br>
   * @param month the month period
   * @param year the year period
   * @param startDate the start date of the period.
   * @param endDate the end date of the period.
   * @returns the pulse data.
   */
  getPulse(month?: number, year?: number, startDate?: string, endDate?: string): Observable<DashboardPulse> {
    return this.http.get<DashboardPulse>(
      `${this.apiUrl}/pulse`, {
        params: this.getPeriodHttpParams(month, year, startDate, endDate)
      });
  }

  /**
   * Gets the cash flow trend data from the backend.
   * @returns the cash flow trend data.
   */
  getCashFlowTrend(): Observable<CashFlowTrend[]> {
    return this.http.get<CashFlowTrend[]>(`${this.apiUrl}/trend/cashflow`);
  }

  /**
   * Gets the YTD summary data from the backend.
   * @param year the year to get the summary for.
   * @returns the YTD summary data.
   */
  getYtdSummary(year: number): Observable<YtdSummary> {
    const params: HttpParams = new HttpParams().set('year', year.toString());

    return this.http.get<YtdSummary>(
      `${this.apiUrl}/ytd`,
      {
        params
      });
  }

  /**
   * Gets the action items from the backend.
   * @returns the action items.
   */
  getActionItems(): Observable<ActionItem[]> {
    return this.http.get<ActionItem[]>(`${this.apiUrl}/actions`);
  }

  /**
   * Constructs parameters for endpoints that require period data.
   * @param month the month to get data for.
   * @param year the year to get data for.
   * @param startDate the start date of the period.
   * @param endDate the end date of the period.
   * @returns the constructed HttpParams object.
   */
  private getPeriodHttpParams(month?: number, year?: number, startDate?: string, endDate?: string): HttpParams {
    let params: HttpParams = new HttpParams();

    if (startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    } else if (month && year) {
      params = params.set('month', month.toString()).set('year', year.toString());
    }

    return params;
  }
}
