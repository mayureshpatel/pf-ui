import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpContext} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {CategoryRule, CategoryRuleCreateRequest, RuleChangePreview} from '@models/category-rule.model';
import {AuthService} from '@core/auth/auth.service';
import {SKIP_GENERIC_ERROR_TOAST} from '@core/auth/error.interceptor';

const SKIP_TOAST_OPTIONS = {context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true)};

/**
 * Service for managing automated category assignment rules.
 *
 * Rules are used to automatically categorize uncategorized transactions
 * based on keyword matching in transaction descriptions.
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryRuleApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/category-rules`;

  /**
   * Retrieves all defined category rules for the current user.
   */
  getRules(): Observable<CategoryRule[]> {
    return this.http.get<CategoryRule[]>(this.apiUrl, SKIP_TOAST_OPTIONS);
  }

  /**
   * Creates a new category rule.
   * @param data - The rule configuration (keyword, category, priority).
   */
  createRule(data: CategoryRuleCreateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;

    return this.http.post<number>(this.apiUrl, {...data, userId});
  }

  /**
   * Generates a preview of transactions that would be updated by the current ruleset.
   */
  previewApply(): Observable<RuleChangePreview[]> {
    return this.http.get<RuleChangePreview[]>(`${this.apiUrl}/preview`, SKIP_TOAST_OPTIONS);
  }

  /**
   * Executes the rule engine on all current uncategorized transactions.
   */
  applyRules(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/apply`, {}, SKIP_TOAST_OPTIONS);
  }

  /**
   * Deletes a specific category rule.
   * @param id - The unique identifier of the rule.
   */
  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, SKIP_TOAST_OPTIONS);
  }
}
