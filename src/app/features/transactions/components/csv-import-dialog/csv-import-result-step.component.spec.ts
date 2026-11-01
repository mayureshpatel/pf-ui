import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

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
import { CsvImportResultStepComponent } from './csv-import-result-step.component';

function account(id: number, bank: BankName): Account {
  return { id, bank, name: `Account ${id}` } as Account;
}

function preview(description: string, overrides: Partial<TransactionPreview> = {}) {
  return {
    date: '2026-01-05',
    postDate: '2026-01-06',
    description,
    amount: -12.5,
    type: TransactionType.EXPENSE,
    suggestedCategory: null,
    suggestedMerchant: null,
    duplicate: false,
    ...overrides,
  } as TransactionPreview;
}

function imported(r: SaveTransactionRequest, duplicateRowCount = 0): FileImportResult {
  return {
    fileName: r.fileName,
    status: 'IMPORTED',
    savedCount: r.transactions.length - duplicateRowCount,
    duplicateRowCount,
    error: null,
  };
}

interface Setup {
  previews: Record<string, TransactionPreview[]>;
  failingPreview?: Record<string, string>;
  /** Builds the bulk response from the request; defaults to every file imported. */
  save?: (requests: SaveTransactionRequest[]) => Observable<FileImportResult[]>;
  suggestions?: () => Observable<TransferSuggestion[]>;
}

describe('CsvImportResultStepComponent', () => {
  let fixture: ComponentFixture<CsvImportResultStepComponent>;
  let store: CsvImportBatchStore;
  let saveBulk: ReturnType<typeof vi.fn>;
  let getSuggestions: ReturnType<typeof vi.fn>;

  const text = (el: Element = fixture.nativeElement): string =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const outcomes = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="file-outcome"]'));
  const outcomeFor = (name: string): HTMLElement =>
    outcomes().find((o: HTMLElement): boolean => text(o).includes(name))!;
  const button = (testId: string): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup({
    previews,
    failingPreview = {},
    save = (requests) => of(requests.map((r) => imported(r))),
    suggestions = () => of([]),
  }: Setup): Promise<void> {
    saveBulk = vi.fn(save);
    getSuggestions = vi.fn(suggestions);
    await TestBed.configureTestingModule({
      imports: [CsvImportResultStepComponent],
      providers: [
        CsvImportBatchStore,
        { provide: TransactionApiService, useValue: { getTransferSuggestions: getSuggestions } },
        {
          provide: TransactionImportService,
          useValue: {
            calculateFileHash: async (f: File): Promise<string> => `hash-${f.name}`,
            checkAlreadyImported: () => of([]),
            uploadCsv: (_id: number, f: File) =>
              failingPreview[f.name]
                ? throwError(
                    () =>
                      new HttpErrorResponse({
                        status: 400,
                        error: { detail: failingPreview[f.name] },
                      }),
                  )
                : of(previews[f.name] ?? []),
            saveBulkTransactions: saveBulk,
          },
        },
      ],
    }).compileComponents();
    store = TestBed.inject(CsvImportBatchStore);
    store.setAccounts([account(1, BankName.CAPITAL_ONE), account(2, BankName.DISCOVER)]);
    store.addFiles(
      [...Object.keys(previews), ...Object.keys(failingPreview)].map(
        (n: string): File => new File(['x'], n),
      ),
    );
    await store.previewAll();
    await store.commit();
    fixture = TestBed.createComponent(CsvImportResultStepComponent);
    await settle();
  }

  it('reports each file as imported, skipped or failed with icon and text', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('A'), preview('B'), preview('C', { duplicate: true })],
        'capone-2026-02.csv': [],
        'discover-2026-01.csv': [preview('D', { duplicate: true })],
        'discover-2026-02.csv': [preview('E')],
      },
      failingPreview: { 'discover-2026-03.csv': 'Unexpected header row' },
      save: (requests) =>
        of(
          requests.map((r): FileImportResult =>
            r.fileName === 'discover-2026-02.csv'
              ? {
                  fileName: r.fileName,
                  status: 'SKIPPED_ALREADY_IMPORTED',
                  savedCount: 0,
                  duplicateRowCount: 0,
                  error: null,
                }
              : imported(r),
          ),
        ),
    });

    const first = outcomeFor('capone-2026-01.csv');
    expect(text(first)).toContain('Imported');
    expect(text(first)).toContain('2 transactions saved');
    expect(text(first)).toContain('1 duplicate skipped');
    expect(first.querySelector('i.pi-check-circle')).not.toBeNull();

    expect(text(outcomeFor('capone-2026-02.csv'))).toContain('Skipped: no transactions in file');
    expect(text(outcomeFor('discover-2026-01.csv'))).toContain('Skipped: no new transactions');
    expect(text(outcomeFor('discover-2026-01.csv'))).toContain('1 duplicate skipped');
    expect(text(outcomeFor('discover-2026-02.csv'))).toContain('Skipped: already imported');

    const failed = outcomeFor('discover-2026-03.csv');
    expect(text(failed)).toContain('Failed');
    expect(text(failed)).toContain('Unexpected header row');
    expect(failed.querySelector('i.pi-times-circle')).not.toBeNull();

    // skipped-row counts come from the rows: the client never sends duplicates
    expect(text(fixture.nativeElement.querySelector('[data-testid="result-summary"]'))).toBe(
      '1 of 5 files imported - 2 transactions, 2 duplicates skipped, 3 files skipped, 1 failed',
    );
  });

  it('adds the backend duplicate count to the rows skipped before sending', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('A'), preview('B'), preview('C', { duplicate: true })],
      },
      save: (requests) => of(requests.map((r) => imported(r, 1))),
    });

    expect(text(outcomeFor('capone-2026-01.csv'))).toContain('1 transaction saved');
    expect(text(outcomeFor('capone-2026-01.csv'))).toContain('2 duplicates skipped');
  });

  it('retries files whose commit failed and shows the new outcome', async () => {
    let attempt = 0;
    await setup({
      previews: { 'capone-2026-01.csv': [preview('A')], 'discover-2026-01.csv': [preview('B')] },
      save: (requests) => {
        attempt++;
        return of(
          requests.map((r): FileImportResult =>
            attempt === 1 && r.fileName === 'discover-2026-01.csv'
              ? {
                  fileName: r.fileName,
                  status: 'FAILED',
                  savedCount: 0,
                  duplicateRowCount: 0,
                  error: 'Database unavailable',
                }
              : imported(r),
          ),
        );
      },
    });
    expect(text(outcomeFor('discover-2026-01.csv'))).toContain('Database unavailable');

    button('retry-failed')!.click();
    await settle();

    expect(saveBulk).toHaveBeenCalledTimes(2);
    expect(saveBulk.mock.calls[1][0].map((r: SaveTransactionRequest) => r.fileName)).toEqual([
      'discover-2026-01.csv',
    ]);
    expect(text(outcomeFor('discover-2026-01.csv'))).toContain('Imported');
    expect(button('retry-failed')).toBeNull();
  });

  it('disables Retry while the retry is running', async () => {
    const pending = new Subject<FileImportResult[]>();
    let attempt = 0;
    await setup({
      previews: { 'capone-2026-01.csv': [preview('A')] },
      save: () => (++attempt === 1 ? throwError(() => new Error('offline')) : pending),
    });

    button('retry-failed')!.click();
    await settle();

    expect(button('retry-failed')!.disabled).toBe(true);
    pending.next([
      {
        fileName: 'capone-2026-01.csv',
        status: 'IMPORTED',
        savedCount: 1,
        duplicateRowCount: 0,
        error: null,
      },
    ]);
    pending.complete();
    await settle();
    expect(button('retry-failed')).toBeNull();
  });

  it('does not offer Retry for files that could not be read', async () => {
    await setup({
      previews: { 'capone-2026-01.csv': [preview('A')] },
      failingPreview: { 'discover-2026-01.csv': 'Unexpected header row' },
    });

    expect(button('retry-failed')).toBeNull();
  });

  it('offers to review the possible transfers and emits when pressed', async () => {
    await setup({
      previews: { 'capone-2026-01.csv': [preview('A')] },
      suggestions: () => of([{}, {}, {}] as TransferSuggestion[]),
    });
    const emitted = vi.fn();
    fixture.componentInstance.reviewTransfers.subscribe(emitted);

    const review = button('review-transfers')!;
    expect(text(review)).toBe('Review 3 possible transfers');
    review.click();

    expect(emitted).toHaveBeenCalledTimes(1);
    expect(getSuggestions).toHaveBeenCalledTimes(1);
  });

  it('hides the transfer button when there are none', async () => {
    await setup({ previews: { 'capone-2026-01.csv': [preview('A')] } });

    expect(button('review-transfers')).toBeNull();
  });

  it('hides the transfer button when the suggestions cannot be loaded', async () => {
    await setup({
      previews: { 'capone-2026-01.csv': [preview('A')] },
      suggestions: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    expect(button('review-transfers')).toBeNull();
    expect(outcomes().length).toBe(1);
  });
});
