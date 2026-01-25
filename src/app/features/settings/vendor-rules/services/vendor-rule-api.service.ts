import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { VendorRule, VendorRuleDto } from '@models/vendor-rule.model';

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

  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
