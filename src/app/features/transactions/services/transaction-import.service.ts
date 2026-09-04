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

  /**
   * Uploads a CSV file in a bank-specific format and returns a preview of the
   * transactions it contains, without saving them.
   * @param accountId the account to associate the import with.
   * @param file the CSV file to upload.
   * @param bankName the bank format to parse the file as.
   * @returns the previewed transactions parsed from the file.
   */
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

  /**
   * Saves a single previewed transaction to an account.
   * @param accountId the account to save the transaction to.
   * @param request the transaction to save.
   * @returns a confirmation message from the backend.
   */
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

  /**
   * Saves multiple previewed transactions in a single request.
   * @param requests the transactions to save.
   * @returns a confirmation message from the backend.
   */
  saveBulkTransactions(
    requests: SaveTransactionRequest[]
  ): Observable<string> {
    return this.http.post<string>(
      `${this.apiUrl}/transactions/bulk`,
      requests,
      {responseType: 'text' as 'json'}
    );
  }

  /**
   * Computes a SHA-256 hash of a file's contents, used to detect duplicate imports
   * client-side before upload.
   * @param file the file to hash.
   * @returns the hex-encoded hash.
   */
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
