import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  TransactionPreview,
  SaveTransactionRequest,
  BankName
} from '@models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class TransactionImportService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  uploadCsv(
    accountId: number,
    file: File,
    bankName: BankName
  ): Observable<TransactionPreview[]> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankName', bankName);

    return this.http.post<TransactionPreview[]>(
      `${this.apiUrl}/accounts/${accountId}/upload`,
      formData
    );
  }

  saveTransactions(
    accountId: number,
    request: SaveTransactionRequest
  ): Observable<string> {
    return this.http.post<string>(
      `${this.apiUrl}/accounts/${accountId}/transactions`,
      request,
      { responseType: 'text' as 'json' }
    );
  }

  calculateFileHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
}
