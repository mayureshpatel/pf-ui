import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AuthService} from '@core/auth/auth.service';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Merchant, MerchantMergeRequest, MerchantUpdateRequest} from '@models/merchant.model';

@Injectable({
  providedIn: 'root'
})
export class MerchantApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/merchants`;

  /**
   * Gets all merchants for the current user.
   * @returns the list of merchants.
   */
  getMerchants(): Observable<Merchant[]> {
    return this.http.get<Merchant[]>(this.apiUrl);
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
