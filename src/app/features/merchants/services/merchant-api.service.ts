import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Merchant,
  MerchantCreateRequest,
  MerchantDescriptionLink,
  MerchantUpdateRequest,
} from '@models/merchant.model';
import { PageRequest, PageResponse } from '@models/transaction.model';

/**
 * The Merchants page shows its own toast for every failed call (and a batch of links would add one
 * generic toast per failure), so the generic error toast is off for all of these requests.
 */
const SKIP_TOAST_CONTEXT = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

@Injectable({
  providedIn: 'root',
})
export class MerchantApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/merchants`;

  /**
   * Gets a paginated, optionally search-filtered page of the current user's merchants (PF-320).
   * @param search an optional case-insensitive substring matched against name or city.
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

    return this.http.get<PageResponse<Merchant>>(this.apiUrl, {
      params,
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Creates a new merchant owned by the current user.
   * @param request the merchant's name and optional location.
   * @returns the new merchant's generated id.
   */
  createMerchant(request: MerchantCreateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.post<number>(
      this.apiUrl,
      { ...request, userId },
      { context: SKIP_TOAST_CONTEXT },
    );
  }

  /**
   * Updates a merchant's name and location.
   * @param request the merchant's new name and location fields, including its id.
   * @returns the number of rows updated.
   */
  updateMerchant(request: MerchantUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, request, { context: SKIP_TOAST_CONTEXT });
  }

  /**
   * Deletes a merchant owned by the current user. Dependent transactions are left with a blank
   * merchant rather than erroring; the merchant's description links are removed with it.
   * @param id the merchant id to delete.
   */
  deleteMerchant(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { context: SKIP_TOAST_CONTEXT });
  }

  /**
   * Gets every description linked to a merchant.
   * @param merchantId the merchant id.
   * @returns the merchant's linked descriptions.
   */
  getDescriptionLinks(merchantId: number): Observable<MerchantDescriptionLink[]> {
    return this.http.get<MerchantDescriptionLink[]>(
      `${this.apiUrl}/${merchantId}/description-links`,
      { context: SKIP_TOAST_CONTEXT },
    );
  }

  /**
   * Explicitly links a raw description to a merchant -- overwrites any existing link for that
   * description (last-write-wins).
   * @param merchantId the merchant id to link the description to.
   * @param description the raw description to link.
   */
  addDescriptionLink(merchantId: number, description: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${merchantId}/description-links`,
      { description },
      { context: SKIP_TOAST_CONTEXT },
    );
  }

  /**
   * Removes a single description link. Never touches transactions already assigned that
   * merchant -- only affects future matching.
   * @param merchantId the merchant id the link belongs to.
   * @param linkId the link id to delete.
   */
  deleteDescriptionLink(merchantId: number, linkId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${merchantId}/description-links/${linkId}`, {
      context: SKIP_TOAST_CONTEXT,
    });
  }
}
