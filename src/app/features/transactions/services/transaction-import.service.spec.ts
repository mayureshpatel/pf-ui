import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TransactionImportService } from './transaction-import.service';
import { environment } from '@env';
import { BankName } from '@models/account.model';
import {
  FileImportResult,
  SaveTransactionRequest,
  TransactionPreview,
  TransactionType,
} from '@models/transaction.model';

describe('TransactionImportService', () => {
  let service: TransactionImportService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TransactionImportService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransactionImportService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload csv and return transaction previews', () => {
    const mockAccountId = 1;
    const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });
    const mockBankName = BankName.CAPITAL_ONE;
    const mockResponse: TransactionPreview[] = [
      {
        date: '2023-01-01T00:00:00Z',
        postDate: '2023-01-02T00:00:00Z',
        amount: 100,
        description: 'Test transaction',
        type: TransactionType.EXPENSE,
        suggestedCategory: null,
        suggestedMerchant: null,
        duplicate: false,
      },
    ];

    service.uploadCsv(mockAccountId, mockFile, mockBankName).subscribe((previews) => {
      expect(previews).toEqual(mockResponse);
    });

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/accounts/${mockAccountId}/upload`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.get('bankName')).toBe(mockBankName);
    expect(req.request.body.get('file')).toBe(mockFile);

    req.flush(mockResponse);
  });

  it('should save single transaction batch', () => {
    const mockAccountId = 1;
    const mockRequest: SaveTransactionRequest = {
      accountId: mockAccountId,
      fileName: 'test.csv',
      fileHash: 'testhash',
      transactions: [],
    };
    const mockResponse = 'Successfully saved 0 transactions.';

    service.saveTransactions(mockAccountId, mockRequest).subscribe((response) => {
      expect(response).toBe(mockResponse);
    });

    const req = httpTestingController.expectOne(
      `${environment.apiUrl}/accounts/${mockAccountId}/transactions`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockRequest);

    req.flush(mockResponse);
  });

  it('saveBulkTransactions parses a per-file result list', () => {
    const mockRequests: SaveTransactionRequest[] = [
      {
        accountId: 1,
        fileName: 'test1.csv',
        fileHash: 'hash1',
        transactions: [],
      },
      {
        accountId: 2,
        fileName: 'test2.csv',
        fileHash: 'hash2',
        transactions: [],
      },
    ];
    const mockResponse: FileImportResult[] = [
      {
        fileName: 'test1.csv',
        status: 'IMPORTED',
        savedCount: 3,
        duplicateRowCount: 1,
        error: null,
      },
      {
        fileName: 'test2.csv',
        status: 'FAILED',
        savedCount: 0,
        duplicateRowCount: 0,
        error: 'Merchant not found.',
      },
    ];
    let result: FileImportResult[] | undefined;

    service.saveBulkTransactions(mockRequests).subscribe((response) => (result = response));

    const req = httpTestingController.expectOne(`${environment.apiUrl}/transactions/bulk`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockRequests);
    expect(req.request.responseType).toBe('json');

    req.flush(mockResponse);
    expect(result).toEqual(mockResponse);
  });

  it('checkAlreadyImported posts candidates and returns the matches', () => {
    const candidates = [
      { accountId: 1, fileHash: 'hash1' },
      { accountId: 2, fileHash: 'hash2' },
    ];
    let result: { accountId: number; fileHash: string }[] | undefined;

    service.checkAlreadyImported(candidates).subscribe((response) => (result = response));

    const req = httpTestingController.expectOne(`${environment.apiUrl}/transactions/import-check`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(candidates);

    req.flush([candidates[1]]);
    expect(result).toEqual([candidates[1]]);
  });

  it('should calculate file hash', async () => {
    const mockFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    const expectedHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'; // SHA-256 for 'hello world'

    const hash = await service.calculateFileHash(mockFile);
    expect(hash).toBe(expectedHash);
  });
});
