import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '@core/auth/auth.service';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Merchant, MerchantMergeRequest, MerchantUpdateRequest } from '@models/merchant.model';
import { PageRequest, PageResponse } from '@models/transaction.model';

@Injectable({
  providedIn: 'root',
})
export class MerchantApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/merchants`;

  /**
   * Gets a paginated, optionally search-filtered page of the current user's merchants (PF-320).
   * @param search an optional case-insensitive substring matched against either name column.
   * @param pageRequest the page number, size, and sort to request.
   * @returns the requested page of merchants.
   */
  getMerchants(
    search: string | null,
    pageRequest: PageRequest,
  ): Observable<PageResponse<Merchant>> {
    let params: HttpParams = new HttpParams()
      .set('page', pageRequest.page.toString())
      .set('size', pageRequest.size.toString());

    if (pageRequest.sort) {
      params = params.set('sort', pageRequest.sort);
    }
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PageResponse<Merchant>>(this.apiUrl, { params });
  }

  /**
   * Corrects a merchant's display name.
   * @param request the merchant id and its new clean name.
   * @returns the number of rows updated.
   */
  updateMerchant(request: MerchantUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, request);
  }

  /**
   * Merges one merchant into another.
   * @param request which merchant survives and which gets merged away.
   */
  mergeMerchants(request: MerchantMergeRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/merge`, request);
  }
}
