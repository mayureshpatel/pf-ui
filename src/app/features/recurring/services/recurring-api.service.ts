import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { RecurringTransaction, RecurringTransactionDto, RecurringSuggestion } from '@models/recurring.model';

@Injectable({
  providedIn: 'root'
})
export class RecurringApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/recurring`;

  getRecurringTransactions(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(this.apiUrl);
  }

  getSuggestions(): Observable<RecurringSuggestion[]> {
    return this.http.get<RecurringSuggestion[]>(`${this.apiUrl}/suggestions`);
  }

  createRecurringTransaction(data: RecurringTransactionDto): Observable<RecurringTransaction> {
    return this.http.post<RecurringTransaction>(this.apiUrl, data);
  }

  updateRecurringTransaction(id: number, data: RecurringTransactionDto): Observable<RecurringTransaction> {
    return this.http.put<RecurringTransaction>(`${this.apiUrl}/${id}`, data);
  }

  deleteRecurringTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
