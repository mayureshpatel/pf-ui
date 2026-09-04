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

  /**
   * Gets budgets for a given month and year.
   * @param month the budget month.
   * @param year the budget year.
   * @returns the list of budgets for that period.
   */
  getBudgets(month: number, year: number): Observable<Budget[]> {
    const params: HttpParams = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    return this.http.get<Budget[]>(this.apiUrl, {params});
  }

  /**
   * Gets budget status (allocated vs. spent) for a given month and year.
   * @param month the budget month.
   * @param year the budget year.
   * @returns the list of budget statuses for that period.
   */
  getBudgetStatus(month: number, year: number): Observable<BudgetStatus[]> {
    const params: HttpParams = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    return this.http.get<BudgetStatus[]>(`${this.apiUrl}/status`, {params});
  }

  /**
   * Gets every budget across all periods.
   * @returns the full list of budgets.
   */
  getAllBudgets(): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.apiUrl}/all`);
  }

  /**
   * Creates a budget for a category and period.
   * @param categoryId the category to budget for.
   * @param amount the budgeted amount.
   * @param month the budget month.
   * @param year the budget year.
   * @returns the id of the newly created budget.
   */
  createBudget(categoryId: number, amount: number, month: number, year: number): Observable<number> {
    const userId = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, { userId, categoryId, amount, month, year });
  }

  /**
   * Deletes a budget by id.
   * @param id the budget id to delete.
   */
  deleteBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
