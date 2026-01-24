import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Transaction,
  TransactionFormData,
  TransactionFilter,
  PageRequest,
  PageResponse
} from '@models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class TransactionApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/transactions`;

  getTransactions(
    filter: TransactionFilter,
    pageRequest: PageRequest
  ): Observable<PageResponse<Transaction>> {
    let params = new HttpParams()
      .set('page', pageRequest.page.toString())
      .set('size', pageRequest.size.toString());

    if (pageRequest.sort) {
      params = params.set('sort', pageRequest.sort);
    }

    // Add filter parameters
    if (filter.accountId) params = params.set('accountId', filter.accountId.toString());
    if (filter.type) params = params.set('type', filter.type);
    if (filter.description) params = params.set('description', filter.description);
    if (filter.categoryName) params = params.set('categoryName', filter.categoryName);
    if (filter.vendorName) params = params.set('vendorName', filter.vendorName);
    if (filter.minAmount !== undefined) params = params.set('minAmount', filter.minAmount.toString());
    if (filter.maxAmount !== undefined) params = params.set('maxAmount', filter.maxAmount.toString());
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);

    return this.http.get<PageResponse<Transaction>>(this.apiUrl, { params });
  }

  createTransaction(data: TransactionFormData): Observable<Transaction> {
    return this.http.post<Transaction>(this.apiUrl, data);
  }

  updateTransaction(id: number, data: TransactionFormData): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.apiUrl}/${id}`, data);
  }

  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  bulkDeleteTransactions(ids: number[]): Observable<void> {
    return this.http.request<void>('delete', `${this.apiUrl}/bulk`, { body: ids });
  }

  bulkUpdateTransactions(updates: TransactionFormData[]): Observable<Transaction[]> {
    return this.http.patch<Transaction[]>(`${this.apiUrl}/bulk`, updates);
  }
}
