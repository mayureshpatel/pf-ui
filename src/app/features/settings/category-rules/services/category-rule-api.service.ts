import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {CategoryRule, CategoryRuleRequest} from '@models/category-rule.model';
import {AuthService} from '@core/auth/auth.service';
import {
  RuleChangePreview
} from '@features/settings/vendor-rules/components/apply-rules-dialog/apply-rules-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class CategoryRuleApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/category-rules`;

  getRules(): Observable<CategoryRule[]> {
    return this.http.get<CategoryRule[]>(this.apiUrl);
  }

  createRule(data: CategoryRuleRequest): Observable<number> {
    const userId = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, { ...data, userId });
  }

  previewApply(): Observable<RuleChangePreview[]> {
    return this.http.get<RuleChangePreview[]>(`${this.apiUrl}/preview`);
  }

  applyRules(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/apply`, {});
  }

  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
