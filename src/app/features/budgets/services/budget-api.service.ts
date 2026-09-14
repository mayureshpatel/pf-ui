import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Budget, BudgetStatus } from '@models/budget.model';
import { PageRequest, PageResponse } from '@models/transaction.model';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';

const SKIP_TOAST_CONTEXT = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

@Injectable({
  providedIn: 'root',
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
    return this.http.get<Budget[]>(this.apiUrl, { params });
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
    return this.http.get<BudgetStatus[]>(`${this.apiUrl}/status`, {
      params,
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Gets a page of budgets across all periods, most recent first (PF-320).
   * @param pageRequest the page number and size to request.
   * @returns the requested page of budgets.
   */
  getAllBudgets(pageRequest: PageRequest): Observable<PageResponse<Budget>> {
    const params: HttpParams = new HttpParams()
      .set('page', pageRequest.page.toString())
      .set('size', pageRequest.size.toString());
    return this.http.get<PageResponse<Budget>>(`${this.apiUrl}/all`, {
      params,
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Creates a budget for a category and period.
   * @param categoryId the category to budget for.
   * @param amount the budgeted amount.
   * @param month the budget month.
   * @param year the budget year.
   * @returns the id of the newly created budget.
   */
  createBudget(
    categoryId: number,
    amount: number,
    month: number,
    year: number,
  ): Observable<number> {
    const userId = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, { userId, categoryId, amount, month, year });
  }

  /**
   * Deletes a budget by id.
   * @param id the budget id to delete.
   */
  deleteBudget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { context: SKIP_TOAST_CONTEXT });
  }
}
