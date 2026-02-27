import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {SaveTransactionRequest, TransactionPreview} from '@models/transaction.model';
import {BankName} from '@models/account.model';

@Injectable({
  providedIn: 'root'
})
export class TransactionImportService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = environment.apiUrl;

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
      {responseType: 'text' as 'json'}
    );
  }

  calculateFileHash(file: File): Promise<string> {
    return new Promise((resolve, reject): void => {
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>): Promise<void> => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const hashBuffer: ArrayBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray: number[] = Array.from(new Uint8Array(hashBuffer));
          const hashHex: string = hashArray.map((b: number): string => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (): void => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
}
