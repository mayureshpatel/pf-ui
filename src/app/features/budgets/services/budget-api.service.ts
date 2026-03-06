import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Budget, BudgetStatus} from '@models/budget.model';
import {AuthService} from '@core/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class BudgetApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/budgets`;

  getBudgets(month: number, year: number): Observable<Budget[]> {
    const params: HttpParams = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    return this.http.get<Budget[]>(this.apiUrl, {params});
  }

  getBudgetStatus(month: number, year: number): Observable<BudgetStatus[]> {
    const params: HttpParams = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    return this.http.get<BudgetStatus[]>(`${this.apiUrl}/status`, {params});
  }

  getAllBudgets(): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.apiUrl}/all`);
  }

  createBudget(categoryId: number, amount: number, month: number, year: number): Observable<number> {
    const userId = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, { userId, categoryId, amount, month, year });
  }

  deleteBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
