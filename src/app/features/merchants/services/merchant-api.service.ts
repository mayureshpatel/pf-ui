import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  DescriptionLinkCheck,
  DescriptionLinkResult,
  DescriptionLinkUndoResult,
  Merchant,
  MerchantCreateRequest,
  MerchantDescriptionLink,
  MerchantSuggestion,
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
   * Ranks the user's merchants by how closely their names match each given name, best first.
   * @param names the names to find merchants for (at most 100).
   * @param limit how many merchants to return per name (1 to 20).
   * @returns one entry per name, in the order asked.
   */
  suggestMerchants(names: string[], limit: number): Observable<MerchantSuggestion[]> {
    return this.http.post<MerchantSuggestion[]>(
      `${this.apiUrl}/suggestions`,
      { names, limit },
      { context: SKIP_TOAST_CONTEXT },
    );
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
   * description (last-write-wins) and gives the merchant to existing transactions with that
   * description and no merchant.
   * @param merchantId the merchant id to link the description to.
   * @param description the raw description to link.
   * @returns what changed, in the shape the undo endpoint takes back.
   */
  addDescriptionLink(merchantId: number, description: string): Observable<DescriptionLinkResult> {
    return this.http.post<DescriptionLinkResult>(
      `${this.apiUrl}/${merchantId}/description-links`,
      { description },
      { context: SKIP_TOAST_CONTEXT },
    );
  }

  /**
   * Links many raw descriptions to a merchant in one request (all or nothing). A description
   * already linked to another merchant is moved, and existing transactions with these
   * descriptions and no merchant get it. The API accepts at most 500 at a time.
   * @param merchantId the merchant id to link the descriptions to.
   * @param descriptions the raw descriptions to link (1 to 500).
   * @returns what changed, in the shape the undo endpoint takes back.
   */
  addDescriptionLinks(
    merchantId: number,
    descriptions: string[],
  ): Observable<DescriptionLinkResult> {
    return this.http.post<DescriptionLinkResult>(
      `${this.apiUrl}/${merchantId}/description-links/bulk`,
      { descriptions },
      { context: SKIP_TOAST_CONTEXT },
    );
  }

  /**
   * Checks descriptions about to be linked to a merchant for look-alikes: groups with words the
   * merchant's name lacks while another merchant or selected group has them. Read-only.
   * @param merchantId the merchant the descriptions would be linked to.
   * @param descriptions the raw descriptions (1 to 5,000).
   * @returns the warnings, empty when nothing looks out of place.
   */
  checkDescriptionLinks(
    merchantId: number,
    descriptions: string[],
  ): Observable<DescriptionLinkCheck> {
    return this.http.post<DescriptionLinkCheck>(
      `${this.apiUrl}/${merchantId}/description-links/check`,
      { descriptions },
      { context: SKIP_TOAST_CONTEXT },
    );
  }

  /**
   * Takes a link back from the result it returned. Only what is unchanged since is reversed.
   * @param result the link result, exactly as the link call returned it.
   * @returns what was restored and what was left alone.
   */
  undoDescriptionLinks(result: DescriptionLinkResult): Observable<DescriptionLinkUndoResult> {
    return this.http.post<DescriptionLinkUndoResult>(
      `${this.apiUrl}/${result.merchantId}/description-links/undo`,
      result,
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
