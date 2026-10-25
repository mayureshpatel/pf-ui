import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { RecurringApiService } from './recurring-api.service';

describe('RecurringApiService', () => {
  let service: RecurringApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/recurring`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RecurringApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecurringApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list dismissed patterns', () => {
    // act
    service.getDismissed().subscribe();

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/dismissals`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should dismiss a pattern with its key and name and return the id', () => {
    // arrange
    let id = 0;

    // act
    service.dismiss('net flix', 'Net Flix').subscribe((value) => (id = value));

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/dismissals`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ patternKey: 'net flix', name: 'Net Flix' });
    req.flush(5);
    expect(id).toBe(5);
  });

  it('should restore a dismissed pattern by id', () => {
    // act
    service.restore(5).subscribe();

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/dismissals/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
