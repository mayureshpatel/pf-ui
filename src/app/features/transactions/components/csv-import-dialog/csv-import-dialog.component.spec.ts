import { ChangeDetectionStrategy, Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';

import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { Account, BankName } from '@models/account.model';
import {
  FileImportResult,
  SaveTransactionRequest,
  TransactionPreview,
  TransactionType,
  TransferSuggestion,
} from '@models/transaction.model';
import { CsvImportBatchStore } from './csv-import-batch.store';
import { CsvImportDialogComponent } from './csv-import-dialog.component';

function account(id: number, bank: BankName): Account {
  return { id, bank, name: `Account ${id}` } as Account;
}

function preview(description: string): TransactionPreview {
  return {
    date: '2026-01-05',
    postDate: '2026-01-06',
    description,
    amount: -12.5,
    type: TransactionType.EXPENSE,
    suggestedCategory: null,
    suggestedMerchant: null,
    duplicate: false,
  };
}

@Component({
  imports: [CsvImportDialogComponent],
  template: `
    <button id="trigger" type="button" (click)="visible.set(true)">Import</button>
    <app-csv-import-dialog
      [(visible)]="visible"
      [accounts]="accounts"
      (importComplete)="completed = completed + 1"
      (reviewTransfers)="onReviewTransfers()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly visible: WritableSignal<boolean> = signal(true);
  readonly accounts: Account[] = [account(1, BankName.CAPITAL_ONE), account(2, BankName.DISCOVER)];
  completed = 0;
  transfers = 0;
  /** What had focus when the transfer review was requested (the next dialog captures it). */
  focusedAtTransfers: Element | null = null;

  onReviewTransfers(): void {
    this.transfers++;
    this.focusedAtTransfers = document.activeElement;
  }
}

describe('CsvImportDialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let store: CsvImportBatchStore;
  let confirmSpy: Mock<(confirmation: Confirmation) => void>;
  /** Preview response per file name; a string makes that upload fail with it as the reason. */
  let previews: Record<string, TransactionPreview[] | string | Subject<TransactionPreview[]>>;
  let saveBulk: Mock<(requests: SaveTransactionRequest[]) => Observable<FileImportResult[]>>;
  let suggestions: () => Observable<TransferSuggestion[]>;

  const q = <T extends HTMLElement>(selector: string): T | null =>
    document.querySelector<T>(selector);
  const byTestId = <T extends HTMLElement = HTMLButtonElement>(id: string): T | null =>
    q<T>(`[data-testid="${id}"]`);
  const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const currentStep = (): string =>
    text(document.querySelector('[data-testid="step"][aria-current="step"]'));
  const dialogInstance = (): Dialog =>
    fixture.debugElement.query(By.directive(Dialog)).injector.get(Dialog);

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function addFiles(...names: string[]): Promise<void> {
    store.addFiles(names.map((n: string): File => new File(['x'], n)));
    await settle();
  }

  async function click(id: string): Promise<void> {
    byTestId(id)!.click();
    await settle();
  }

  async function toReview(): Promise<void> {
    previews = { 'capone-2026-01.csv': [preview('A'), preview('B')] };
    await addFiles('capone-2026-01.csv');
    await click('preview');
    await vi.waitFor(() => expect(currentStep()).toContain('Review & edit'));
    await settle();
  }

  beforeEach(async () => {
    previews = {};
    suggestions = () => of([]);
    saveBulk = vi.fn((requests: SaveTransactionRequest[]) =>
      of(
        requests.map((r): FileImportResult => ({
          fileName: r.fileName,
          status: 'IMPORTED',
          savedCount: r.transactions.length,
          duplicateRowCount: 0,
          error: null,
        })),
      ),
    );
    confirmSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule],
      providers: [
        { provide: ConfirmationService, useValue: { confirm: confirmSpy } },
        {
          provide: TransactionImportService,
          useValue: {
            calculateFileHash: async (f: File): Promise<string> => `hash-${f.name}`,
            checkAlreadyImported: () => of([]),
            uploadCsv: (_id: number, f: File) => {
              const response = previews[f.name];
              if (typeof response === 'string') {
                return throwError(
                  () => new HttpErrorResponse({ status: 400, error: { detail: response } }),
                );
              }
              return response instanceof Subject ? response : of(response ?? []);
            },
            saveBulkTransactions: (requests: SaveTransactionRequest[]) => saveBulk(requests),
          },
        },
        {
          provide: TransactionApiService,
          useValue: { getTransferSuggestions: () => suggestions() },
        },
        { provide: CategoryApiService, useValue: { getCategories: () => of([]) } },
        {
          provide: MerchantApiService,
          useValue: {
            getMerchants: () =>
              of({ content: [], page: { totalElements: 0, totalPages: 0, number: 0, size: 2000 } }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await settle();
    store = fixture.debugElement
      .query(By.directive(CsvImportDialogComponent))
      .injector.get(CsvImportBatchStore);
  });

  afterEach(() => fixture.destroy());

  it('starts on the Files step, marked as the current step', () => {
    expect(currentStep()).toContain('Files');
    expect(document.querySelectorAll('[data-testid="step"][aria-current="step"]').length).toBe(1);
    expect(byTestId('preview')!.disabled).toBe(true);
  });

  it('feeds the accounts to the batch so file names are matched', async () => {
    await addFiles('discover-2026-01.csv');

    expect(store.items()[0].accountId).toBe(2);
    expect(byTestId('preview')!.disabled).toBe(false);
  });

  it('moves to Review after a successful preview and focuses the step heading', async () => {
    await toReview();

    expect(currentStep()).toContain('Review & edit');
    expect(document.activeElement).toBe(byTestId('step-heading'));
    expect(text(byTestId('import'))).toBe('Import 2 transactions');
  });

  it('stays on Files with the reasons when no file could be read', async () => {
    previews = { 'capone-2026-01.csv': 'Unexpected header row' };
    await addFiles('capone-2026-01.csv', 'capone-2026-02.xlsx');

    await click('preview');
    await vi.waitFor(() => expect(byTestId('preview-failures')).not.toBeNull());

    expect(currentStep()).toContain('Files');
    const failures = text(byTestId('preview-failures'));
    expect(failures).toContain('2 files could not be read');
    expect(failures).toContain('Could not read this file');
    expect(failures).toContain('.xls');
  });

  it('shows progress while previewing and Stop preview cancels the outstanding uploads', async () => {
    const upload = new Subject<TransactionPreview[]>();
    previews = { 'capone-2026-01.csv': upload };
    await addFiles('capone-2026-01.csv');

    await click('preview');
    await vi.waitFor(() => expect(upload.observed).toBe(true));
    await settle();
    expect(text(byTestId('preview-progress'))).toBe('Previewing 0 of 1 files');

    await click('stop-preview');

    expect(upload.observed).toBe(false);
    expect(store.items()[0].status).toBe('pending');
    expect(currentStep()).toContain('Files');
  });

  it('cancelling mid-preview, once confirmed, cancels the uploads and closes', async () => {
    const upload = new Subject<TransactionPreview[]>();
    previews = { 'capone-2026-01.csv': upload };
    await addFiles('capone-2026-01.csv');
    await click('preview');
    await vi.waitFor(() => expect(upload.observed).toBe(true));
    await settle();

    await click('cancel');
    (confirmSpy.mock.calls[0][0] as Confirmation).accept!();
    await settle();

    expect(upload.observed).toBe(false);
    expect(host.visible()).toBe(false);
    // the batch is cleared once the hide animation has finished
    await vi.waitFor(() => expect(store.items()).toEqual([]), { timeout: 3000 });
  });

  it('keeps the batch on screen while hiding, then reopens on a clean Files step', async () => {
    const dialog = (): CsvImportDialogComponent =>
      fixture.debugElement.query(By.directive(CsvImportDialogComponent)).componentInstance;
    await toReview();

    await click('close-x');
    (confirmSpy.mock.calls[0][0] as Confirmation).accept!();
    await settle();

    // nothing flashes back to an empty Files step during the close animation
    expect(host.visible()).toBe(false);
    expect(dialog().step()).toBe('review');
    expect(store.items().length).toBe(1);

    await vi.waitFor(() => expect(store.items()).toEqual([]), { timeout: 3000 });
    expect(dialog().step()).toBe('files');

    host.visible.set(true);
    await settle();
    await vi.waitFor(() => expect(currentStep()).toContain('Files'));
    expect(store.items()).toEqual([]);
    expect(byTestId('preview')!.disabled).toBe(true);
  });

  it('treats Escape as Cancel when focus has fallen to the page body', async () => {
    await toReview();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape on the page body once the dialog is closed', async () => {
    host.visible.set(false);
    await settle();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('closes without asking when nothing has been chosen', async () => {
    await click('cancel');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(host.visible()).toBe(false);
  });

  it('asks before discarding chosen files, and keeps them when the user declines', async () => {
    await addFiles('capone-2026-01.csv');

    await click('cancel');

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const confirmation = confirmSpy.mock.calls[0][0] as Confirmation;
    expect(confirmation.acceptLabel).toBe('Discard');
    expect(host.visible()).toBe(true);
    expect(store.items().length).toBe(1);
  });

  it('asks before discarding review edits, from the close button and from Escape', async () => {
    await toReview();

    await click('close-x');
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    byTestId<HTMLElement>('step-heading')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await settle();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(host.visible()).toBe(true);
  });

  /** What the real confirmation does: takes focus, then its button is removed on close. */
  function confirmationTakesFocus(): () => void {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    return (): void => button.remove();
  }

  it('returns focus to the control that asked, once the user keeps importing', async () => {
    await toReview();
    const closeX = byTestId('close-x')!;
    closeX.focus();

    await click('close-x');
    const removeConfirmation = confirmationTakesFocus();
    (confirmSpy.mock.calls[0][0] as Confirmation).reject!();
    removeConfirmation();
    await settle();

    await vi.waitFor(() => expect(document.activeElement).toBe(closeX));
    expect(host.visible()).toBe(true);
  });

  it('returns focus to the step heading when Escape on the page asked, then the user kept importing', async () => {
    await toReview();
    (document.activeElement as HTMLElement | null)?.blur();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    const removeConfirmation = confirmationTakesFocus();
    (confirmSpy.mock.calls[0][0] as Confirmation).reject!();
    removeConfirmation();
    await settle();

    await vi.waitFor(() => expect(document.activeElement).toBe(byTestId('step-heading')));
  });

  it('goes back to Files keeping the batch', async () => {
    await toReview();

    await click('back');

    expect(currentStep()).toContain('Files');
    expect(store.items()[0].status).toBe('ready');
    expect(document.activeElement).toBe(byTestId('step-heading'));
  });

  it('shows the Result step after importing, staying open, and reports completion once', async () => {
    suggestions = () => of([{}, {}] as TransferSuggestion[]);
    await toReview();

    await click('import');
    await vi.waitFor(() => expect(currentStep()).toContain('Result'));
    await settle();

    expect(host.visible()).toBe(true);
    expect(host.completed).toBe(1);
    expect(host.transfers).toBe(0);
    expect(text(byTestId('result-summary'))).toContain('1 of 1 file imported');
    expect(text(byTestId('review-transfers'))).toBe('Review 2 possible transfers');
    expect(document.activeElement).toBe(byTestId('step-heading'));
  });

  it('does not report completion when nothing was imported', async () => {
    saveBulk.mockImplementation(() => throwError(() => new Error('offline')));
    await toReview();

    await click('import');
    await vi.waitFor(() => expect(currentStep()).toContain('Result'));
    await settle();

    expect(host.completed).toBe(0);
    expect(byTestId('retry-failed')).not.toBeNull();
  });

  it('closes from Result without asking', async () => {
    await toReview();
    await click('import');
    await vi.waitFor(() => expect(currentStep()).toContain('Result'));
    await settle();

    await click('close');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(host.visible()).toBe(false);
  });

  it('closes, then asks for the transfer review once the dialog has hidden', async () => {
    suggestions = () => of([{}] as TransferSuggestion[]);
    await toReview();
    await click('import');
    await vi.waitFor(() => expect(byTestId('review-transfers')).not.toBeNull());

    byTestId('review-transfers')!.click();
    // not yet: the import dialog must be gone before the transfer dialog takes focus
    expect(host.transfers).toBe(0);
    await settle();
    expect(host.visible()).toBe(false);

    // the close animation finishing is what fires onHide (no-op if it already did)
    dialogInstance().onHide.emit({});
    await vi.waitFor(() => expect(host.transfers).toBe(1));
    expect(host.completed).toBe(1);
  });

  it('has returned focus to the opener by the time the transfer review is requested', async () => {
    suggestions = () => of([{}] as TransferSuggestion[]);
    host.visible.set(false);
    await settle();
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await settle();
    await toReview();
    await click('import');
    await vi.waitFor(() => expect(byTestId('review-transfers')).not.toBeNull());

    await click('review-transfers');

    // the real close animation fires onHide
    await vi.waitFor(() => expect(host.transfers).toBe(1), { timeout: 3000 });
    expect(host.focusedAtTransfers).toBe(trigger);
  });
});
