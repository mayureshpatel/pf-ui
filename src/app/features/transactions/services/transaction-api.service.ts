import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Transaction,
  TransactionFilter,
  TransactionCreateRequest,
  TransactionUpdateRequest,
  PageRequest,
  PageResponse,
  TransferSuggestion
} from '@models/transaction.model';
import {CategoryTransactionCount} from '@models/category.model';

@Injectable({
  providedIn: 'root'
})
export class TransactionApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/transactions`;

  getTransactions(
    filter: TransactionFilter,
    pageRequest: PageRequest
  ): Observable<PageResponse<Transaction>> {
    let params: HttpParams = new HttpParams()
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
    if (filter.merchant) params = params.set('vendorName', filter.merchant);
    if (filter.minAmount) params = params.set('minAmount', filter.minAmount.toString());
    if (filter.maxAmount) params = params.set('maxAmount', filter.maxAmount.toString());
    if (filter.startDate) params = params.set('startDate', filter.startDate.toDateString());
    if (filter.endDate) params = params.set('endDate', filter.endDate.toDateString());

    return this.http.get<PageResponse<Transaction>>(this.apiUrl, { params });
  }

  createTransaction(data: TransactionCreateRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, data);
  }

  updateTransaction(data: TransactionUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data);
  }

  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  bulkDeleteTransactions(ids: number[]): Observable<void> {
    return this.http.request<void>('delete', `${this.apiUrl}/bulk`, { body: ids });
  }

  bulkUpdateTransactions(updates: TransactionUpdateRequest[]): Observable<number> {
    return this.http.patch<number>(`${this.apiUrl}/bulk`, updates);
  }

  getTransferSuggestions(): Observable<TransferSuggestion[]> {
    return this.http.get<TransferSuggestion[]>(`${this.apiUrl}/suggestions/transfers`);
  }

  markAsTransfer(ids: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark-as-transfer`, ids);
  }

  getCountsByCategory(): Observable<CategoryTransactionCount[]> {
    return this.http.get<CategoryTransactionCount[]>(`${this.apiUrl}/count-by-category`);
  }
}
