import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {environment} from '@env';
import {AccountApiService} from './account-api.service';
import {
  Account,
  AccountCreateRequest,
  AccountReconcileRequest,
  AccountType,
  AccountUpdateRequest,
  BankName
} from '@models/account.model';

describe('AccountApiService', () => {
  let service: AccountApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/accounts`;
  const accountTypeApiUrl = `${environment.apiUrl}/account-types`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AccountApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AccountApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAccounts', () => {
    it('should return an Observable<Account[]>', () => {
      const mockAccounts = [{ id: 1, name: 'Test Account' }] as Account[];

      service.getAccounts().subscribe(accounts => {
        expect(accounts.length).toBe(1);
        expect(accounts).toEqual(mockAccounts);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockAccounts);
    });
  });

  describe('create', () => {
    it('should POST a new account and return ID', () => {
      const createReq: AccountCreateRequest = {
        name: 'New Account',
        type: 'CHECKING',
        startingBalance: 100,
        currencyCode: 'USD',
        bankName: 'STANDARD'
      };

      service.create(createReq).subscribe(id => {
        expect(id).toBe(1);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(1);
    });
  });

  describe('update', () => {
    it('should PUT an existing account and return ID', () => {
      const updateReq: AccountUpdateRequest = {
        id: 1,
        name: 'Updated Account',
        type: 'SAVINGS',
        currencyCode: 'USD',
        bankName: 'STANDARD',
        version: 1
      };

      service.update(updateReq).subscribe(id => {
        expect(id).toBe(1);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(1);
    });
  });

  describe('reconcile', () => {
    it('should POST reconcile data and return ID', () => {
      const reconcileReq: AccountReconcileRequest = {
        id: 1,
        newBalance: 500,
        version: 1
      };

      service.reconcile(reconcileReq).subscribe(id => {
        expect(id).toBe(1);
      });

      const req = httpMock.expectOne(`${apiUrl}/reconcile`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(reconcileReq);
      req.flush(1);
    });
  });

  describe('delete', () => {
    it('should DELETE an account by id', () => {
      const accountId = 1;

      service.delete(accountId).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/${accountId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getAccountTypes', () => {
    it('should return an Observable<AccountType[]>', () => {
      const mockTypes = [{ code: 'CHECKING', label: 'Checking' }] as AccountType[];

      service.getAccountTypes().subscribe(types => {
        expect(types.length).toBe(1);
        expect(types).toEqual(mockTypes);
      });

      const req = httpMock.expectOne(accountTypeApiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockTypes);
    });
  });
});
