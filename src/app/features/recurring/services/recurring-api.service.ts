import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {RecurringRequest, RecurringSuggestion, RecurringTransaction} from '@models/recurring.model';

@Injectable({
  providedIn: 'root'
})
export class RecurringApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/recurring`;

  getAll(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(this.apiUrl);
  }

  getSuggestions(): Observable<RecurringSuggestion[]> {
    return this.http.get<RecurringSuggestion[]>(`${this.apiUrl}/suggestions`);
  }

  create(request: RecurringRequest): Observable<RecurringTransaction> {
    return this.http.post<RecurringTransaction>(this.apiUrl, request);
  }

  update(request: RecurringRequest & { id: number }): Observable<RecurringTransaction> {
    return this.http.put<RecurringTransaction>(this.apiUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
