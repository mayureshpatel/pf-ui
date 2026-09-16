import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '@core/auth/auth.service';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Merchant,
  MerchantMergeRequest,
  MerchantReviewCluster,
  MerchantUpdateRequest,
} from '@models/merchant.model';
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

  /**
   * Gets a paginated, optionally search-filtered page of the current user's distinct, non-blank
   * clean names (PF-842) -- backs the two-level clean-name picker and the grouped Merchants
   * view's outer rows.
   * @param search an optional case-insensitive substring matched against clean name.
   * @param pageRequest the page number and size to request.
   * @returns the requested page of distinct clean names.
   */
  getDistinctCleanNames(
    search: string | null,
    pageRequest: PageRequest,
  ): Observable<PageResponse<string>> {
    let params: HttpParams = new HttpParams()
      .set('page', pageRequest.page.toString())
      .set('size', pageRequest.size.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PageResponse<string>>(`${this.apiUrl}/clean-names`, { params });
  }

  /**
   * Gets every merchant sharing an exact clean name (PF-842) -- a grouped view's expanded detail
   * rows for one outer group.
   * @param cleanName the exact clean name to look up.
   * @returns the group's member merchants.
   */
  getMerchantsByCleanName(cleanName: string): Observable<Merchant[]> {
    const params: HttpParams = new HttpParams().set('cleanName', cleanName);
    return this.http.get<Merchant[]>(`${this.apiUrl}/by-clean-name`, { params });
  }

  /**
   * Gets the current user's merchants needing review, clustered by suggested clean name (PF-842).
   * @returns the user's review clusters, largest first.
   */
  getMerchantsNeedingReview(): Observable<MerchantReviewCluster[]> {
    return this.http.get<MerchantReviewCluster[]>(`${this.apiUrl}/needs-review`);
  }

  /**
   * Updates multiple merchants' clean names in a single request (PF-842) -- confirming a whole
   * review cluster in one action.
   * @param requests the corrections to apply, each including its merchant id.
   * @returns the number of merchants updated.
   */
  updateMerchantsBulk(requests: MerchantUpdateRequest[]): Observable<number> {
    return this.http.patch<number>(`${this.apiUrl}/bulk`, requests);
  }
}
