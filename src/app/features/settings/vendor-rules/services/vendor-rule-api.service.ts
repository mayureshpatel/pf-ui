import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { VendorRule, VendorRuleDto, UnmatchedVendor } from '@models/vendor-rule.model';
import { RuleChangePreview } from '../components/apply-rules-dialog/apply-rules-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class VendorRuleApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vendor-rules`;

  getRules(): Observable<VendorRule[]> {
    return this.http.get<VendorRule[]>(this.apiUrl);
  }

  createRule(data: VendorRuleDto): Observable<VendorRule> {
    return this.http.post<VendorRule>(this.apiUrl, data);
  }

  previewApply(): Observable<RuleChangePreview[]> {
    return this.http.get<RuleChangePreview[]>(`${this.apiUrl}/preview`);
  }

  applyRules(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/apply`, {});
  }

  getUnmatchedVendors(): Observable<UnmatchedVendor[]> {
    return this.http.get<UnmatchedVendor[]>(`${this.apiUrl}/unmatched`);
  }

  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
