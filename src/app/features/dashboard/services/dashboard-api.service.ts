import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { DashboardData, DailyBalance } from '@models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  getDashboardData(month: number, year: number): Observable<DashboardData> {
    const params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());

    return this.http.get<DashboardData>(this.apiUrl, { params });
  }

  getNetWorthHistory(): Observable<DailyBalance[]> {
    return this.http.get<DailyBalance[]>(`${this.apiUrl}/net-worth-history`);
  }
}
