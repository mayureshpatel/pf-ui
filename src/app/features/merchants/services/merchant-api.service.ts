import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AuthService} from '@core/auth/auth.service';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Merchant} from '@models/merchant.model';

@Injectable({
  providedIn: 'root'
})
export class MerchantApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/merchants`;

  getMerchants(): Observable<Merchant[]> {
    return this.http.get<Merchant[]>(this.apiUrl);
  }
}
