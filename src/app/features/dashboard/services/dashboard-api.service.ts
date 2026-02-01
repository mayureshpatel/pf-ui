import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { 
  DashboardData, 
  DailyBalance, 
  DashboardPulse, 
  CashFlowTrend, 
  YtdSummary, 
  ActionItem,
  CategoryTotal,
  VendorTotal
} from '@models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  getCategoryBreakdown(month?: number, year?: number, startDate?: string, endDate?: string): Observable<CategoryTotal[]> {
    let params = new HttpParams();
    if (startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    } else if (month && year) {
      params = params.set('month', month.toString()).set('year', year.toString());
    }

    return this.http.get<CategoryTotal[]>(`${this.apiUrl}/categories`, { params });
  }

  getVendorBreakdown(month?: number, year?: number, startDate?: string, endDate?: string): Observable<VendorTotal[]> {
    let params = new HttpParams();
    if (startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    } else if (month && year) {
      params = params.set('month', month.toString()).set('year', year.toString());
    }

    return this.http.get<VendorTotal[]>(`${this.apiUrl}/vendors`, { params });
  }

  getPulse(month?: number, year?: number, startDate?: string, endDate?: string): Observable<DashboardPulse> {
    let params = new HttpParams();
    if (startDate && endDate) {
      params = params.set('startDate', startDate).set('endDate', endDate);
    } else if (month && year) {
      params = params.set('month', month.toString()).set('year', year.toString());
    }
    return this.http.get<DashboardPulse>(`${this.apiUrl}/pulse`, { params });
  }

  getCashFlowTrend(): Observable<CashFlowTrend[]> {
    return this.http.get<CashFlowTrend[]>(`${this.apiUrl}/trend/cashflow`);
  }

  getYtdSummary(year: number): Observable<YtdSummary> {
    const params = new HttpParams().set('year', year.toString());
    return this.http.get<YtdSummary>(`${this.apiUrl}/ytd`, { params });
  }

  getActionItems(): Observable<ActionItem[]> {
    return this.http.get<ActionItem[]>(`${this.apiUrl}/actions`);
  }

  getNetWorthHistory(): Observable<DailyBalance[]> {
    return this.http.get<DailyBalance[]>(`${this.apiUrl}/net-worth-history`);
  }
}
