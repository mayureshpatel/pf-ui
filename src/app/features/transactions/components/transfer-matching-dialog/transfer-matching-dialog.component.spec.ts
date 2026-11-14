import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { TransferMatchingDialogComponent } from './transfer-matching-dialog.component';
import { TransactionApiService } from '../../services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { Transaction, TransferSuggestion } from '@models/transaction.model';

describe('TransferMatchingDialogComponent', () => {
  let component: TransferMatchingDialogComponent;
  let fixture: ComponentFixture<TransferMatchingDialogComponent>;
  let mockTransactionApi: Mocked<
    Pick<TransactionApiService, 'getTransferSuggestions' | 'markAsTransfer' | 'unmarkAsTransfer'>
  >;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;

  const txn = (id: number, description: string): Transaction =>
    ({
      id,
      account: { name: 'Checking' },
      category: null,
      amount: -100,
      date: new Date('2026-01-15'),
      description,
      type: 'TRANSFER',
      merchant: { name: description },
    }) as unknown as Transaction;

  const mockSuggestions: TransferSuggestion[] = [
    { sourceTransaction: txn(1, 'Out'), targetTransaction: txn(2, 'In'), confidenceScore: 0.9 },
  ];

  beforeEach(async () => {
    mockTransactionApi = {
      getTransferSuggestions: vi.fn().mockReturnValue(of(mockSuggestions)),
      markAsTransfer: vi.fn().mockReturnValue(of(undefined)),
      unmarkAsTransfer: vi.fn().mockReturnValue(of(undefined)),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TransferMatchingDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: TransactionApiService, useValue: mockTransactionApi },
        { provide: ToastService, useValue: mockToast },
      ],
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

  it('PF-891: should colour the match-confidence pill with the accessible emerald pair', () => {
    const pill = Array.from(document.querySelectorAll('span')).find((el) =>
      el.textContent?.includes('% match'),
    );

    expect(pill).toBeTruthy();
    expect(pill!.classList).toContain('text-primary-700');
    expect(pill!.classList).toContain('dark:text-primary-400');
    expect(pill!.classList).not.toContain('text-primary');
  });

  describe('PF-945: approving matches', () => {
    const pair = (a: number, b: number, score: number): TransferSuggestion => ({
      sourceTransaction: txn(a, 'Out'),
      targetTransaction: txn(b, 'In'),
      confidenceScore: score,
    });

    const load = (data: TransferSuggestion[]): void => {
      mockTransactionApi.getTransferSuggestions.mockReturnValue(of(data));
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
    };

    it('lists a transfer once when the matcher reports it in both directions', () => {
      load([pair(1, 2, 0.9), pair(2, 1, 0.95), pair(3, 4, 0.8)]);

      expect(component.suggestions().length).toBe(2);
      expect(
        component
          .suggestions()
          .find((s) => s.sourceTransaction.id === 2 || s.sourceTransaction.id === 1)!
          .confidenceScore,
      ).toBe(0.95);
    });

    it('names the number of pairs in the Approve button and counts only high-confidence ones', () => {
      load([pair(1, 2, 0.95), pair(3, 4, 0.9), pair(5, 6, 0.7)]);

      expect(component.approveAllLabel()).toBe('Approve 2 pairs');
    });

    it('approves only the high-confidence pairs and leaves the rest for review', () => {
      load([pair(1, 2, 0.95), pair(5, 6, 0.7)]);

      component.confirmAll();

      expect(mockTransactionApi.markAsTransfer).toHaveBeenCalledWith([1, 2]);
      expect(component.suggestions().map((s) => s.sourceTransaction.id)).toEqual([5]);
    });

    it('groups rows into Ready to approve and Needs review, ready first', () => {
      load([pair(5, 6, 0.7), pair(1, 2, 0.95)]);

      expect(component.rows().map((r) => r.group)).toEqual(['Ready to approve', 'Needs review']);
    });

    it('keeps the dialog open after approving and offers Undo', () => {
      load([pair(1, 2, 0.95)]);

      component.confirmAll();
      fixture.detectChanges();

      expect(component.visible()).toBe(true);
      expect(document.querySelector('[data-testid="approval-status"]')?.textContent).toContain(
        'Approved 1 pair',
      );
    });

    it('undoes the last approval: unmarks the same ids and puts the pairs back', () => {
      load([pair(1, 2, 0.95)]);
      component.confirmAll();
      expect(component.suggestions().length).toBe(0);

      component.undoLastApproval();

      expect(mockTransactionApi.unmarkAsTransfer).toHaveBeenCalledWith([1, 2]);
      expect(component.suggestions().length).toBe(1);
      expect(component.lastApproved()).toBeNull();
    });
  });
});
