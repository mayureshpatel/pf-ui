import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BatchFile, CsvImportBatchStore } from './csv-import-batch.store';
import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { Account, BankName } from '@models/account.model';
import {
  FileImportResult,
  SaveTransactionRequest,
  TransactionPreview,
  TransactionType,
} from '@models/transaction.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';

function account(id: number, bank: BankName): Account {
  return { id, bank, name: `Account ${id}` } as Account;
}

function csv(name: string, content = 'Date,Description,Amount\n'): File {
  return new File([content], name, { type: 'text/csv' });
}

function category(id: number, name: string): Category {
  return { id, name } as Category;
}

function merchant(id: number, name: string): Merchant {
  return { id, name } as Merchant;
}

function row(overrides: Partial<TransactionPreview> = {}): TransactionPreview {
  return {
    date: '2026-01-05T00:00:00Z',
    postDate: '2026-01-06T00:00:00Z',
    description: 'COFFEE SHOP',
    amount: 4.5,
    type: TransactionType.EXPENSE,
    suggestedCategory: null,
    suggestedMerchant: null,
    duplicate: false,
    ...overrides,
  };
}

const ACCOUNTS: Account[] = [
  account(1, BankName.CAPITAL_ONE),
  account(2, BankName.DISCOVER),
  account(3, BankName.SYNOVUS),
];

describe('CsvImportBatchStore', () => {
  let store: CsvImportBatchStore;
  /** Preview response per file name; an HttpErrorResponse makes that upload fail. */
  let previews: Record<string, TransactionPreview[] | HttpErrorResponse>;
  let alreadyImported: { accountId: number; fileHash: string }[];

  const importService = {
    uploadCsv: vi.fn(),
    calculateFileHash: vi.fn(),
    checkAlreadyImported: vi.fn(),
    saveBulkTransactions: vi.fn(),
  };

  function fileByName(name: string): BatchFile {
    const found: BatchFile | undefined = store.items().find((f: BatchFile) => f.file.name === name);
    if (!found) throw new Error(`no file ${name}`);
    return found;
  }

  function requestsSent(callIndex = 0): SaveTransactionRequest[] {
    return importService.saveBulkTransactions.mock.calls[callIndex][0] as SaveTransactionRequest[];
  }

  function imported(fileName: string, savedCount = 1): FileImportResult {
    return { fileName, status: 'IMPORTED', savedCount, duplicateRowCount: 0, error: null };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    previews = {};
    alreadyImported = [];
    importService.uploadCsv.mockImplementation(
      (_accountId: number, file: File): Observable<TransactionPreview[]> => {
        const response: TransactionPreview[] | HttpErrorResponse | undefined = previews[file.name];
        if (response instanceof HttpErrorResponse) return throwError(() => response);
        return of(response ?? []);
      },
    );
    importService.calculateFileHash.mockImplementation(
      async (file: File): Promise<string> => `hash-${file.name}`,
    );
    importService.checkAlreadyImported.mockImplementation(() => of(alreadyImported));
    importService.saveBulkTransactions.mockImplementation((requests: SaveTransactionRequest[]) =>
      of(requests.map((r: SaveTransactionRequest) => imported(r.fileName, r.transactions.length))),
    );

    TestBed.configureTestingModule({
      providers: [
        CsvImportBatchStore,
        { provide: TransactionImportService, useValue: importService },
      ],
    });
    store = TestBed.inject(CsvImportBatchStore);
    store.setAccounts(ACCOUNTS);
  });

  describe('adding files', () => {
    it('keeps one entry when the same name and size is added twice', () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('capone-2026-01.csv')]);
      store.addFiles([csv('capone-2026-01.csv')]);

      expect(store.items().length).toBe(1);
    });

    it('reports how many files were not added because they are already in the list', () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);
      expect(store.notAddedCount()).toBe(0);

      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv'), csv('new.csv')]);

      expect(store.items().length).toBe(3);
      expect(store.notAddedCount()).toBe(2);

      store.addFiles([csv('other.csv')]);
      expect(store.notAddedCount()).toBe(0);
    });

    it('clears the not-added count on reset', () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('capone-2026-01.csv')]);
      expect(store.notAddedCount()).toBe(1);

      store.reset();

      expect(store.notAddedCount()).toBe(0);
    });

    it('keeps both when the name matches but the size differs', () => {
      store.addFiles([csv('capone-2026-01.csv', 'a'), csv('capone-2026-01.csv', 'abc')]);

      expect(store.items().length).toBe(2);
    });

    it('infers account, bank and month from the file name', () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('Synvous-2026-07.csv')]);

      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        accountId: 1,
        bankName: BankName.CAPITAL_ONE,
        statementMonth: '2026-01',
        matchReason: 'matched',
        status: 'pending',
      });
      expect(fileByName('Synvous-2026-07.csv')).toMatchObject({
        accountId: null,
        bankName: null,
        statementMonth: null,
        matchReason: 'unrecognised-name',
      });
    });

    it('removes a file by id', () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);

      store.removeFile(fileByName('capone-2026-01.csv').id);

      expect(store.items().map((f: BatchFile) => f.file.name)).toEqual(['discover-2026-01.csv']);
    });
  });

  describe('account and bank assignment', () => {
    it('cannot preview until every file has an account and a bank', () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('statement.csv')]);
      expect(store.canPreview()).toBe(false);

      const id: string = fileByName('statement.csv').id;
      store.setAccount(id, 2);
      store.setBank(id, BankName.DISCOVER);

      expect(store.canPreview()).toBe(true);
    });

    it('cannot preview an empty batch', () => {
      expect(store.canPreview()).toBe(false);
    });

    it('does not let an Excel file without an account or bank block Preview', async () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('capone-2026-02.xlsx')]);

      expect(fileByName('capone-2026-02.xlsx').accountId).toBeNull();
      expect(store.canPreview()).toBe(true);
      expect(store.summary().needsAccountCount).toBe(0);

      await store.previewAll();

      expect(fileByName('capone-2026-01.csv').status).toBe('ready');
      expect(fileByName('capone-2026-02.xlsx')).toMatchObject({ status: 'failed' });
      expect(fileByName('capone-2026-02.xlsx').error).toContain('.xls');
      expect(importService.uploadCsv).toHaveBeenCalledTimes(1);
    });

    it('can preview a batch of only Excel files, which all fail with the reason', async () => {
      store.addFiles([csv('statement.xls')]);

      expect(store.canPreview()).toBe(true);
      await store.previewAll();

      expect(fileByName('statement.xls').status).toBe('failed');
      expect(fileByName('statement.xls').error).toContain('.xls');
    });

    it('applies an account and bank to only the selected files', () => {
      store.addFiles([csv('a.csv'), csv('b.csv'), csv('c.csv')]);
      const ids: string[] = [fileByName('a.csv').id, fileByName('b.csv').id];

      store.applyToSelected(ids, 3, BankName.SYNOVUS);

      expect(fileByName('a.csv')).toMatchObject({ accountId: 3, bankName: BankName.SYNOVUS });
      expect(fileByName('b.csv')).toMatchObject({ accountId: 3, bankName: BankName.SYNOVUS });
      expect(fileByName('c.csv')).toMatchObject({ accountId: null, bankName: null });
    });

    it('leaves the bank alone when applying only an account', () => {
      store.addFiles([csv('capone-2026-01.csv')]);
      const id: string = fileByName('capone-2026-01.csv').id;

      store.applyToSelected([id], 2, null);

      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        accountId: 2,
        bankName: BankName.CAPITAL_ONE,
      });
    });
  });

  describe('preview', () => {
    it('builds review rows with prefilled merchant and category', async () => {
      const groceries: Category = category(10, 'Groceries');
      const shop: Merchant = merchant(20, 'Corner Shop');
      previews['capone-2026-01.csv'] = [
        row({ description: 'CORNER SHOP', suggestedCategory: groceries, suggestedMerchant: shop }),
        row({ description: 'UNKNOWN' }),
        row({ description: 'SEEN BEFORE', duplicate: true }),
      ];
      store.addFiles([csv('capone-2026-01.csv')]);

      await store.previewAll();

      const file: BatchFile = fileByName('capone-2026-01.csv');
      expect(file.status).toBe('ready');
      expect(file.hash).toBe('hash-capone-2026-01.csv');
      expect(file.rows.map((r) => [r.merchant, r.category, r.origin, r.skip])).toEqual([
        [shop, groceries, 'rule', null],
        [null, null, 'none', null],
        [null, null, 'none', 'duplicate'],
      ]);
    });

    it('keeps previewing other files when one fails, showing the csv parsing detail', async () => {
      const parsingDetail =
        'Failed to parse the provided CSV file. Please check the file format and try again.';
      previews['capone-2026-01.csv'] = new HttpErrorResponse({
        status: 400,
        error: { status: 400, title: 'Bad Request', detail: parsingDetail },
      });
      previews['discover-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);

      await store.previewAll();

      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        status: 'failed',
        error: expect.stringContaining(parsingDetail),
      });
      expect(fileByName('discover-2026-01.csv').status).toBe('ready');
    });

    it('shows a generic message instead of any other backend detail', async () => {
      previews['capone-2026-01.csv'] = new HttpErrorResponse({
        status: 400,
        error: { status: 400, title: 'Bad Request', detail: 'For input string: "12,34x"' },
      });
      store.addFiles([csv('capone-2026-01.csv')]);

      await store.previewAll();

      const error: string | null = fileByName('capone-2026-01.csv').error;
      expect(error).not.toContain('12,34x');
      expect(error).toBe(
        'Could not read this file. Check that the bank format matches the statement.',
      );
    });

    it('rejects Excel files without uploading them', async () => {
      store.addFiles([csv('capone-2026-01.xlsx')]);
      store.applyToSelected([fileByName('capone-2026-01.xlsx').id], 1, BankName.CAPITAL_ONE);

      await store.previewAll();

      const file: BatchFile = fileByName('capone-2026-01.xlsx');
      expect(file.status).toBe('failed');
      expect(file.error).toContain('.xls');
      expect(importService.uploadCsv).not.toHaveBeenCalled();
    });

    it('uploads at most four files at a time', async () => {
      const pending: Subject<TransactionPreview[]>[] = [];
      importService.uploadCsv.mockImplementation(() => {
        const subject = new Subject<TransactionPreview[]>();
        pending.push(subject);
        return subject;
      });
      store.addFiles([1, 2, 3, 4, 5, 6].map((m: number) => csv(`capone-2026-0${m}.csv`)));

      const done: Promise<void> = store.previewAll();
      await vi.waitFor(() => expect(importService.uploadCsv).toHaveBeenCalledTimes(4));

      pending[0].next([row()]);
      pending[0].complete();
      await vi.waitFor(() => expect(importService.uploadCsv).toHaveBeenCalledTimes(5));
      expect(store.items().filter((f: BatchFile) => f.status === 'previewing').length).toBe(4);

      for (let i = 1; i < 6; i++) {
        await vi.waitFor(() => expect(pending.length).toBeGreaterThan(i));
        pending[i].next([row()]);
        pending[i].complete();
      }
      await done;
      expect(store.items().every((f: BatchFile) => f.status === 'ready')).toBe(true);
    });

    it('stops starting uploads when cancelled and leaves unfinished files pending', async () => {
      importService.uploadCsv.mockImplementation(() => new Subject<TransactionPreview[]>());
      store.addFiles([1, 2, 3, 4, 5, 6].map((m: number) => csv(`capone-2026-0${m}.csv`)));

      const done: Promise<void> = store.previewAll();
      await vi.waitFor(() => expect(importService.uploadCsv).toHaveBeenCalledTimes(4));
      store.cancelPreview();
      await done;

      expect(importService.uploadCsv).toHaveBeenCalledTimes(4);
      expect(store.items().every((f: BatchFile) => f.status === 'pending')).toBe(true);
      expect(store.previewing()).toBe(false);
    });

    it('checks already-imported files once for the batch and skips their rows', async () => {
      previews['capone-2026-01.csv'] = [row(), row({ description: 'OTHER' })];
      previews['discover-2026-01.csv'] = [row()];
      alreadyImported = [{ accountId: 1, fileHash: 'hash-capone-2026-01.csv' }];
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);

      await store.previewAll();

      expect(importService.checkAlreadyImported).toHaveBeenCalledTimes(1);
      expect(importService.checkAlreadyImported).toHaveBeenCalledWith([
        { accountId: 1, fileHash: 'hash-capone-2026-01.csv' },
        { accountId: 2, fileHash: 'hash-discover-2026-01.csv' },
      ]);
      const done: BatchFile = fileByName('capone-2026-01.csv');
      expect(done.alreadyImported).toBe(true);
      expect(done.rows.map((r) => r.skip)).toEqual([
        'file-already-imported',
        'file-already-imported',
      ]);
      expect(fileByName('discover-2026-01.csv').alreadyImported).toBe(false);
    });

    it('marks a later file row as duplicate of an earlier file for the same account', async () => {
      const shared: TransactionPreview = row({ description: 'RENT', amount: 1200.0 });
      previews['capone-2026-01.csv'] = [shared];
      previews['capone-2026-02.csv'] = [shared, row({ description: 'NEW' })];
      previews['discover-2026-02.csv'] = [shared];
      store.addFiles([
        csv('capone-2026-01.csv'),
        csv('capone-2026-02.csv'),
        csv('discover-2026-02.csv'),
      ]);

      await store.previewAll();

      expect(fileByName('capone-2026-01.csv').rows[0].skip).toBeNull();
      expect(fileByName('capone-2026-02.csv').rows.map((r) => r.skip)).toEqual(['duplicate', null]);
      expect(fileByName('discover-2026-02.csv').rows[0].skip).toBeNull();
    });

    it('clears a cross-file duplicate when the earlier file is removed', async () => {
      previews['capone-2026-01.csv'] = [row()];
      previews['capone-2026-02.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv'), csv('capone-2026-02.csv')]);
      await store.previewAll();

      store.removeFile(fileByName('capone-2026-01.csv').id);

      expect(fileByName('capone-2026-02.csv').rows[0].skip).toBeNull();
    });
  });

  describe('preview while files change', () => {
    let uploads: Map<string, Subject<TransactionPreview[]>>;

    beforeEach(() => {
      uploads = new Map();
      importService.uploadCsv.mockImplementation((_accountId: number, file: File) => {
        const subject = new Subject<TransactionPreview[]>();
        uploads.set(file.name, subject);
        return subject;
      });
    });

    function respond(name: string, rows: TransactionPreview[] = [row()]): void {
      const subject: Subject<TransactionPreview[]> | undefined = uploads.get(name);
      if (!subject) throw new Error(`no upload for ${name}`);
      subject.next(rows);
      subject.complete();
    }

    it('does not keep the old account already-imported flag for a queued file', async () => {
      const names: string[] = [1, 2, 3, 4, 5].map((m: number) => `capone-2026-0${m}.csv`);
      alreadyImported = [{ accountId: 1, fileHash: 'hash-capone-2026-05.csv' }];
      store.addFiles(names.map((n: string) => csv(n)));

      const done: Promise<void> = store.previewAll();
      await vi.waitFor(() => expect(uploads.size).toBe(4));
      expect(fileByName('capone-2026-05.csv')).toMatchObject({
        status: 'pending',
        alreadyImported: true,
      });

      store.setAccount(fileByName('capone-2026-05.csv').id, 3);
      names.slice(0, 4).forEach((n: string) => respond(n));
      await vi.waitFor(() => expect(uploads.size).toBe(5));
      respond('capone-2026-05.csv');
      await done;

      const moved: BatchFile = fileByName('capone-2026-05.csv');
      expect(importService.uploadCsv.mock.calls[4][0]).toBe(3);
      expect(moved).toMatchObject({ accountId: 3, status: 'ready', alreadyImported: false });
      expect(moved.rows[0].skip).toBeNull();
    });

    it('stops before uploading when cancelled while files are being hashed', async () => {
      let releaseHash: (hash: string) => void = () => undefined;
      importService.calculateFileHash.mockImplementation(
        () => new Promise<string>((resolve) => (releaseHash = resolve)),
      );
      store.addFiles([csv('capone-2026-01.csv')]);

      const done: Promise<void> = store.previewAll();
      store.cancelPreview();
      releaseHash('late-hash');
      await done;

      expect(importService.checkAlreadyImported).not.toHaveBeenCalled();
      expect(importService.uploadCsv).not.toHaveBeenCalled();
      expect(fileByName('capone-2026-01.csv').status).toBe('pending');
    });

    it('does not count a cancelled run against a preview started right after it', async () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);
      const first: Promise<void> = store.previewAll();
      await vi.waitFor(() => expect(uploads.size).toBe(2));
      uploads.clear();

      store.cancelPreview();
      const second: Promise<void> = store.previewAll();
      await first;
      await vi.waitFor(() => expect(uploads.size).toBe(2));

      expect(store.previewProgress()).toEqual({ done: 0, total: 2 });
      expect(store.items().every((f: BatchFile) => f.status === 'previewing')).toBe(true);
      respond('capone-2026-01.csv');
      respond('discover-2026-01.csv');
      await second;
      expect(store.previewProgress()).toEqual({ done: 2, total: 2 });
    });

    it('drops uploads that answer after a cancel', async () => {
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);

      const done: Promise<void> = store.previewAll();
      await vi.waitFor(() => expect(uploads.size).toBe(2));
      store.cancelPreview();
      await done;
      respond('capone-2026-01.csv');
      respond('discover-2026-01.csv');

      expect(store.items().map((f: BatchFile) => [f.status, f.rows.length])).toEqual([
        ['pending', 0],
        ['pending', 0],
      ]);
    });

    it('drops the upload of a file removed or changed mid-upload and still completes progress', async () => {
      store.addFiles([
        csv('capone-2026-01.csv'),
        csv('discover-2026-01.csv'),
        csv('synovus-2026-01.csv'),
      ]);

      const done: Promise<void> = store.previewAll();
      await vi.waitFor(() => expect(uploads.size).toBe(3));
      const removedUpload: Subject<TransactionPreview[]> = uploads.get(
        'capone-2026-01.csv',
      ) as Subject<TransactionPreview[]>;
      store.removeFile(fileByName('capone-2026-01.csv').id);
      store.setAccount(fileByName('discover-2026-01.csv').id, 1);
      respond('discover-2026-01.csv');
      respond('synovus-2026-01.csv');
      await done;

      expect(removedUpload.observed).toBe(false);
      expect(fileByName('discover-2026-01.csv')).toMatchObject({
        status: 'pending',
        accountId: 1,
        rows: [],
      });
      expect(fileByName('synovus-2026-01.csv').status).toBe('ready');
      expect(store.previewProgress()).toEqual({ done: 3, total: 3 });
      expect(store.previewing()).toBe(false);
    });

    it('checks already-imported files in chunks of 1000', async () => {
      importService.uploadCsv.mockImplementation(() => of([]));
      store.addFiles(
        Array.from({ length: 1001 }, (_: unknown, i: number) => csv(`statement-${i}.csv`)),
      );
      store.applyToSelected(
        store.items().map((f: BatchFile) => f.id),
        1,
        BankName.CAPITAL_ONE,
      );

      await store.previewAll();

      expect(importService.checkAlreadyImported).toHaveBeenCalledTimes(2);
      expect(importService.checkAlreadyImported.mock.calls.map((c) => c[0].length)).toEqual([
        1000, 1,
      ]);
    });
  });

  describe('editing rows', () => {
    it('changes exactly the edited row even when descriptions are identical', async () => {
      const dining: Category = category(11, 'Dining');
      previews['capone-2026-01.csv'] = [row({ amount: 1 }), row({ amount: 2 }), row({ amount: 3 })];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      const before: BatchFile = fileByName('capone-2026-01.csv');

      store.editRow(before.id, 1, { category: dining });

      const after: BatchFile = fileByName('capone-2026-01.csv');
      expect(after.rows[1]).toMatchObject({ category: dining, merchant: null, origin: 'edited' });
      expect(after.rows[0]).toEqual(before.rows[0]);
      expect(after.rows[2]).toEqual(before.rows[2]);
    });

    it('changes only the merchant when only the merchant is patched', async () => {
      const groceries: Category = category(10, 'Groceries');
      const shop: Merchant = merchant(20, 'Shop');
      previews['capone-2026-01.csv'] = [row({ suggestedCategory: groceries })];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();

      store.editRow(fileByName('capone-2026-01.csv').id, 0, { merchant: shop });

      expect(fileByName('capone-2026-01.csv').rows[0]).toMatchObject({
        merchant: shop,
        category: groceries,
        origin: 'edited',
      });
    });
  });

  describe('going back and changing a file', () => {
    it('re-previews only the changed file, keeping edits on the others', async () => {
      const dining: Category = category(11, 'Dining');
      previews['capone-2026-01.csv'] = [row()];
      previews['discover-2026-01.csv'] = [row({ description: 'GAS' })];
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);
      await store.previewAll();
      store.editRow(fileByName('capone-2026-01.csv').id, 0, { category: dining });
      store.editRow(fileByName('discover-2026-01.csv').id, 0, { category: dining });

      store.setAccount(fileByName('capone-2026-01.csv').id, 3);

      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        status: 'pending',
        rows: [],
        discardedEdits: true,
      });
      expect(fileByName('discover-2026-01.csv').rows[0].origin).toBe('edited');

      importService.uploadCsv.mockClear();
      await store.previewAll();

      expect(importService.uploadCsv).toHaveBeenCalledTimes(1);
      expect(importService.uploadCsv.mock.calls[0][0]).toBe(3);
      expect(fileByName('capone-2026-01.csv').status).toBe('ready');
      expect(fileByName('discover-2026-01.csv').rows[0]).toMatchObject({
        category: dining,
        origin: 'edited',
      });
    });

    it('does not flag discarded edits when the changed file had none', async () => {
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();

      store.setBank(fileByName('capone-2026-01.csv').id, BankName.UNIVERSAL);

      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        status: 'pending',
        discardedEdits: false,
      });
    });

    it('keeps rows when the same account is chosen again', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();

      store.setAccount(fileByName('capone-2026-01.csv').id, 1);

      expect(fileByName('capone-2026-01.csv')).toMatchObject({ status: 'ready' });
      expect(fileByName('capone-2026-01.csv').rows.length).toBe(1);
    });
  });

  describe('commit', () => {
    it('sends only ready files with their committable rows and reviewed values', async () => {
      const dining: Category = category(11, 'Dining');
      const shop: Merchant = merchant(20, 'Shop');
      previews['capone-2026-01.csv'] = [
        row({ amount: -12.5, description: 'LUNCH' }),
        row({ description: 'OLD', duplicate: true }),
      ];
      previews['discover-2026-01.csv'] = new HttpErrorResponse({ status: 400 });
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);
      await store.previewAll();
      store.editRow(fileByName('capone-2026-01.csv').id, 0, { merchant: shop, category: dining });

      await store.commit();

      expect(importService.saveBulkTransactions).toHaveBeenCalledTimes(1);
      expect(requestsSent()).toEqual([
        {
          fileName: 'capone-2026-01.csv',
          fileHash: 'hash-capone-2026-01.csv',
          accountId: 1,
          merchantsReviewed: true,
          transactions: [
            {
              date: '2026-01-05T00:00:00Z',
              postDate: '2026-01-06T00:00:00Z',
              type: TransactionType.EXPENSE,
              amount: 12.5,
              description: 'LUNCH',
              merchant: shop,
              category: dining,
            },
          ],
        },
      ]);
      expect(fileByName('capone-2026-01.csv').status).toBe('committed');
      expect(fileByName('discover-2026-01.csv').status).toBe('failed');
    });

    it('reports header-only, all-duplicate and already-imported files as skipped without sending them', async () => {
      previews['capone-2026-01.csv'] = [];
      previews['capone-2026-02.csv'] = [row({ duplicate: true })];
      previews['discover-2026-01.csv'] = [row()];
      previews['synovus-2026-01.csv'] = [row({ description: 'PAY' })];
      alreadyImported = [{ accountId: 2, fileHash: 'hash-discover-2026-01.csv' }];
      store.addFiles([
        csv('capone-2026-01.csv'),
        csv('capone-2026-02.csv'),
        csv('discover-2026-01.csv'),
        csv('synovus-2026-01.csv'),
      ]);
      await store.previewAll();

      await store.commit();

      expect(requestsSent().map((r: SaveTransactionRequest) => r.fileName)).toEqual([
        'synovus-2026-01.csv',
      ]);
      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        status: 'skipped',
        skipReason: 'no-rows',
      });
      expect(fileByName('capone-2026-02.csv')).toMatchObject({
        status: 'skipped',
        skipReason: 'all-duplicates',
      });
      expect(fileByName('discover-2026-01.csv')).toMatchObject({
        status: 'skipped',
        skipReason: 'already-imported',
      });
      expect(fileByName('synovus-2026-01.csv').status).toBe('committed');
    });

    it('does not call the backend when every file is excluded', async () => {
      previews['capone-2026-01.csv'] = [];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();

      const results: FileImportResult[] = await store.commit();

      expect(results).toEqual([]);
      expect(importService.saveBulkTransactions).not.toHaveBeenCalled();
      expect(fileByName('capone-2026-01.csv').status).toBe('skipped');
    });

    it('maps each backend result back to its file', async () => {
      previews['capone-2026-01.csv'] = [row()];
      previews['discover-2026-01.csv'] = [row()];
      previews['synovus-2026-01.csv'] = [row()];
      store.addFiles([
        csv('capone-2026-01.csv'),
        csv('discover-2026-01.csv'),
        csv('synovus-2026-01.csv'),
      ]);
      await store.previewAll();
      const results: FileImportResult[] = [
        imported('capone-2026-01.csv'),
        {
          fileName: 'discover-2026-01.csv',
          status: 'SKIPPED_ALREADY_IMPORTED',
          savedCount: 0,
          duplicateRowCount: 0,
          error: null,
        },
        // a FAILED file arrives inside the 200 response, not as an HTTP error
        {
          fileName: 'synovus-2026-01.csv',
          status: 'FAILED',
          savedCount: 0,
          duplicateRowCount: 0,
          error: 'Merchant not found.',
        },
      ];
      importService.saveBulkTransactions.mockReturnValue(of(results));

      const returned: FileImportResult[] = await store.commit();

      expect(returned).toEqual(results);
      expect(fileByName('capone-2026-01.csv')).toMatchObject({
        status: 'committed',
        result: results[0],
      });
      expect(fileByName('discover-2026-01.csv')).toMatchObject({
        status: 'skipped',
        skipReason: 'already-imported',
      });
      expect(fileByName('synovus-2026-01.csv')).toMatchObject({
        status: 'failed',
        error: 'Merchant not found.',
      });
    });

    it('gives a failed result a message even when the backend omits the error', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      importService.saveBulkTransactions.mockReturnValue(
        of([
          { fileName: 'capone-2026-01.csv', status: 'FAILED', savedCount: 0, duplicateRowCount: 0 },
        ]),
      );

      await store.commit();

      expect(fileByName('capone-2026-01.csv').status).toBe('failed');
      expect(fileByName('capone-2026-01.csv').error).toBeTruthy();
    });

    it('gives a failed result a message when the backend error is blank', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      importService.saveBulkTransactions.mockReturnValue(
        of([
          {
            fileName: 'capone-2026-01.csv',
            status: 'FAILED',
            savedCount: 0,
            duplicateRowCount: 0,
            error: '  ',
          },
        ]),
      );

      await store.commit();

      expect(fileByName('capone-2026-01.csv').error?.trim()).toBeTruthy();
    });

    it('maps results to two files with the same name in request order', async () => {
      importService.uploadCsv.mockImplementation((_accountId: number, file: File) =>
        of([row({ description: `ROW-${file.size}` })]),
      );
      store.addFiles([csv('statement.csv', 'a'), csv('statement.csv', 'abc')]);
      store.applyToSelected(
        store.items().map((f: BatchFile) => f.id),
        1,
        BankName.CAPITAL_ONE,
      );
      await store.previewAll();
      importService.saveBulkTransactions.mockReturnValue(
        of([
          imported('statement.csv'),
          {
            fileName: 'statement.csv',
            status: 'FAILED',
            savedCount: 0,
            duplicateRowCount: 0,
            error: 'Merchant not found.',
          },
        ]),
      );

      await store.commit();

      const sentDescriptions: string[] = requestsSent().map(
        (r: SaveTransactionRequest) => r.transactions[0].description,
      );
      expect(sentDescriptions).toEqual(['ROW-1', 'ROW-3']);
      expect(store.items().map((f: BatchFile) => [f.file.size, f.status])).toEqual([
        [1, 'committed'],
        [3, 'failed'],
      ]);
    });

    it('ignores changes made while a commit is in flight and maps the result to what was sent', async () => {
      const dining: Category = category(11, 'Dining');
      previews['capone-2026-01.csv'] = [row()];
      previews['discover-2026-01.csv'] = [row({ description: 'GAS' })];
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);
      await store.previewAll();
      const response = new Subject<FileImportResult[]>();
      importService.saveBulkTransactions.mockReturnValue(response);

      const done: Promise<FileImportResult[]> = store.commit();
      const capone: string = fileByName('capone-2026-01.csv').id;
      store.setAccount(capone, 3);
      store.setBank(capone, BankName.SYNOVUS);
      store.applyToSelected([capone], 2, BankName.DISCOVER);
      store.editRow(capone, 0, { category: dining });
      store.removeFile(fileByName('discover-2026-01.csv').id);
      store.addFiles([csv('synovus-2026-01.csv')]);
      response.next([imported('capone-2026-01.csv'), imported('discover-2026-01.csv')]);
      response.complete();
      await done;

      expect(store.items().map((f: BatchFile) => f.file.name)).toEqual([
        'capone-2026-01.csv',
        'discover-2026-01.csv',
      ]);
      const committed: BatchFile = fileByName('capone-2026-01.csv');
      expect(committed).toMatchObject({
        status: 'committed',
        accountId: requestsSent()[0].accountId,
        bankName: BankName.CAPITAL_ONE,
      });
      expect(committed.rows[0]).toMatchObject({ category: null, origin: 'none' });
    });

    it('marks the sent files failed when the whole request fails, and retries only those', async () => {
      previews['capone-2026-01.csv'] = [row()];
      previews['discover-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv'), csv('discover-2026-01.csv')]);
      await store.previewAll();
      importService.saveBulkTransactions.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );

      await store.commit();

      expect(store.items().map((f: BatchFile) => f.status)).toEqual(['failed', 'failed']);
      expect(fileByName('capone-2026-01.csv').error).toBeTruthy();

      importService.saveBulkTransactions.mockReturnValueOnce(
        of([
          imported('capone-2026-01.csv'),
          {
            fileName: 'discover-2026-01.csv',
            status: 'FAILED',
            savedCount: 0,
            duplicateRowCount: 0,
            error: 'Merchant not found.',
          },
        ]),
      );
      await store.retryFailed();
      expect(fileByName('capone-2026-01.csv').status).toBe('committed');

      await store.retryFailed();

      expect(importService.saveBulkTransactions).toHaveBeenCalledTimes(3);
      expect(requestsSent(2).map((r: SaveTransactionRequest) => r.fileName)).toEqual([
        'discover-2026-01.csv',
      ]);
      expect(fileByName('discover-2026-01.csv').status).toBe('committed');
    });

    it('does not send already committed files again', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      await store.commit();

      await store.commit();
      await store.retryFailed();

      expect(importService.saveBulkTransactions).toHaveBeenCalledTimes(1);
    });

    it('does not change the rows of committed files after commit', async () => {
      previews['capone-2026-01.csv'] = [row()];
      previews['capone-2026-02.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv'), csv('capone-2026-02.csv')]);
      await store.previewAll();
      await store.commit();
      expect(fileByName('capone-2026-02.csv').status).toBe('committed');

      store.removeFile(fileByName('capone-2026-01.csv').id);

      expect(fileByName('capone-2026-02.csv').rows[0].skip).toBe('duplicate');
    });

    it('tells the backend merchants were reviewed and sends a cleared merchant as null', async () => {
      const shop: Merchant = merchant(20, 'Shop');
      previews['capone-2026-01.csv'] = [row({ suggestedMerchant: shop })];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      store.editRow(fileByName('capone-2026-01.csv').id, 0, { merchant: null });

      await store.commit();

      const [request] = requestsSent();
      expect(request.merchantsReviewed).toBe(true);
      expect(request.transactions[0].merchant).toBeNull();
    });

    it('still sends rows duplicated from an earlier file so the backend decides', async () => {
      const shared: TransactionPreview = row({ description: 'RENT', amount: 1200 });
      previews['capone-2026-01.csv'] = [shared];
      previews['capone-2026-02.csv'] = [shared, row({ description: 'OLD', duplicate: true })];
      previews['capone-2026-03.csv'] = [shared];
      store.addFiles([
        csv('capone-2026-01.csv'),
        csv('capone-2026-02.csv'),
        csv('capone-2026-03.csv'),
      ]);
      await store.previewAll();
      // review still predicts the cross-file row will be skipped
      expect(fileByName('capone-2026-02.csv').rows[0].skip).toBe('duplicate');
      importService.saveBulkTransactions.mockReturnValueOnce(
        of([
          {
            fileName: 'capone-2026-01.csv',
            status: 'FAILED',
            savedCount: 0,
            duplicateRowCount: 0,
            error: 'Could not import this file.',
          },
          imported('capone-2026-02.csv', 1),
          {
            fileName: 'capone-2026-03.csv',
            status: 'IMPORTED',
            savedCount: 0,
            duplicateRowCount: 1,
            error: null,
          },
        ]),
      );

      await store.commit();

      const sent: SaveTransactionRequest[] = requestsSent();
      expect(sent.map((r: SaveTransactionRequest) => r.fileName)).toEqual([
        'capone-2026-01.csv',
        'capone-2026-02.csv',
        'capone-2026-03.csv',
      ]);
      // the backend-flagged duplicate is still never sent
      expect(sent[1].transactions.map((t) => t.description)).toEqual(['RENT']);
      expect(fileByName('capone-2026-02.csv').status).toBe('committed');
      expect(fileByName('capone-2026-03.csv').result?.duplicateRowCount).toBe(1);
    });

    it('does not retry files whose preview failed', async () => {
      previews['capone-2026-01.csv'] = new HttpErrorResponse({ status: 400 });
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();

      await store.retryFailed();

      expect(importService.saveBulkTransactions).not.toHaveBeenCalled();
    });
  });

  describe('canCommit', () => {
    it('is false before preview and true once a file is ready', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      expect(store.canCommit()).toBe(false);

      await store.previewAll();

      expect(store.canCommit()).toBe(true);
    });

    it('is false after everything is committed', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      await store.commit();

      expect(store.canCommit()).toBe(false);
    });

    it('is false while a file still waits for preview', async () => {
      previews['capone-2026-01.csv'] = [row()];
      store.addFiles([csv('capone-2026-01.csv')]);
      await store.previewAll();
      store.addFiles([csv('discover-2026-01.csv')]);

      expect(store.canCommit()).toBe(false);
    });
  });

  describe('summary', () => {
    it('counts files, the month span, missing months and files needing an account', () => {
      store.addFiles([
        csv('capone-2026-01.csv'),
        csv('capone-2026-02.csv'),
        csv('capone-2026-05.csv'),
        csv('discover-2026-02.csv'),
        csv('Synvous-2026-07.csv'),
        csv('standard-2026-03.csv'),
      ]);

      expect(store.summary()).toEqual({
        fileCount: 6,
        firstMonth: '2026-01',
        lastMonth: '2026-05',
        missingMonths: ['2026-04'],
        needsAccountCount: 2,
      });
    });

    it('spans a year boundary', () => {
      store.addFiles([csv('capone-2025-11.csv'), csv('capone-2026-02.csv')]);

      expect(store.summary().missingMonths).toEqual(['2025-12', '2026-01']);
    });

    it('is empty for an empty batch', () => {
      expect(store.summary()).toEqual({
        fileCount: 0,
        firstMonth: null,
        lastMonth: null,
        missingMonths: [],
        needsAccountCount: 0,
      });
    });
  });

  it('reset clears the batch', async () => {
    store.addFiles([csv('capone-2026-01.csv')]);
    await store.previewAll();

    store.reset();

    expect(store.items()).toEqual([]);
    expect(store.canPreview()).toBe(false);
  });
});
