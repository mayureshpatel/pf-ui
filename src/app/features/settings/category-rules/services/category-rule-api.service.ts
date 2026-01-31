import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { CategoryRule, CategoryRuleDto } from '@models/category-rule.model';
import { RuleChangePreview } from '@features/settings/vendor-rules/components/apply-rules-dialog/apply-rules-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class CategoryRuleApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/category-rules`;

  getRules(): Observable<CategoryRule[]> {
    return this.http.get<CategoryRule[]>(this.apiUrl);
  }

  createRule(data: CategoryRuleDto): Observable<CategoryRule> {
    return this.http.post<CategoryRule>(this.apiUrl, data);
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
