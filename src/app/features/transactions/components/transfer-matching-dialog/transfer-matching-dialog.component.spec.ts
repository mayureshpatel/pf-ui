import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';

import {TransferMatchingDialogComponent} from './transfer-matching-dialog.component';
import {TransactionApiService} from '../../services/transaction-api.service';
import {ToastService} from '@core/services/toast.service';
import {Transaction, TransferSuggestion} from '@models/transaction.model';

describe('TransferMatchingDialogComponent', () => {
  let component: TransferMatchingDialogComponent;
  let fixture: ComponentFixture<TransferMatchingDialogComponent>;
  let mockTransactionApi: any;
  let mockToast: any;

  const txn = (id: number, description: string): Transaction =>
    ({
      id,
      account: {name: 'Checking'},
      category: null,
      amount: -100,
      date: new Date('2026-01-15'),
      description,
      type: 'TRANSFER',
      merchant: {originalName: description}
    }) as unknown as Transaction;

  const mockSuggestions: TransferSuggestion[] = [
    {sourceTransaction: txn(1, 'Out'), targetTransaction: txn(2, 'In'), confidenceScore: 0.9}
  ];

  beforeEach(async () => {
    mockTransactionApi = {
      getTransferSuggestions: vi.fn().mockReturnValue(of(mockSuggestions)),
      markAsTransfer: vi.fn().mockReturnValue(of(undefined))
    };
    mockToast = {success: vi.fn(), error: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [TransferMatchingDialogComponent, NoopAnimationsModule],
      providers: [
        {provide: TransactionApiService, useValue: mockTransactionApi},
        {provide: ToastService, useValue: mockToast}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransferMatchingDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Confirm Pair button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-check)');
    expect(button.getAttribute('aria-label')).toBe('Confirm Pair');
  });

  it('should give the Ignore button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-times)');
    expect(button.getAttribute('aria-label')).toBe('Ignore');
  });
});
