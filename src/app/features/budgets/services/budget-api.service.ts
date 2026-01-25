import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Budget, BudgetDto, BudgetStatus} from '@models/budget.model';

@Injectable({
  providedIn: 'root'
})
export class BudgetApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/budgets`;

  getBudgets(month: number, year: number): Observable<Budget[]> {
    const params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    return this.http.get<Budget[]>(this.apiUrl, {params});
  }

  getBudgetStatus(month: number, year: number): Observable<BudgetStatus[]> {
    const params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    return this.http.get<BudgetStatus[]>(`${this.apiUrl}/status`, {params});
  }

  getAllBudgets(): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.apiUrl}/all`);
  }

  setBudget(data: BudgetDto): Observable<Budget> {
    return this.http.post<Budget>(this.apiUrl, data);
  }

  deleteBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
