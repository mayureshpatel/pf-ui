import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable, Subscription } from 'rxjs';

import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { Account, BankName } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import {
  FileImportResult,
  SaveTransactionRequest,
  TransactionDto,
  TransactionPreview,
} from '@models/transaction.model';
import { FileMatch, FileMatchReason, matchFile } from './csv-import-file-matcher';

export type BatchFileStatus =
  'pending' | 'previewing' | 'ready' | 'failed' | 'committed' | 'skipped';

/** Where a row's category came from. Every backend suggestion counts as `'rule'` (see store doc). */
export type ReviewRowOrigin = 'rule' | 'guess' | 'edited' | 'none';

export type ReviewRowSkip = 'duplicate' | 'file-already-imported' | null;

/** Why a file was skipped at commit; set together with `status: 'skipped'`. */
export type FileSkipReason = 'already-imported' | 'no-rows' | 'all-duplicates';

export interface ReviewRow {
  preview: TransactionPreview;
  merchant: Merchant | null;
  category: Category | null;
  origin: ReviewRowOrigin;
  skip: ReviewRowSkip;
}

export interface BatchFile {
  id: string;
  file: File;
  accountId: number | null;
  bankName: BankName | null;
  /** `YYYY-MM` from the file name, or null when the name does not fit `<bank>-YYYY-MM.csv`. */
  statementMonth: string | null;
  /** What the file-name matcher concluded when the file was added. */
  matchReason: FileMatchReason;
  hash: string | null;
  alreadyImported: boolean;
  status: BatchFileStatus;
  error: string | null;
  rows: ReviewRow[];
  /** True when an account/bank change threw away this file's review edits. */
  discardedEdits: boolean;
  /** Which step a `'failed'` status came from; only commit failures are retryable. */
  failedAt: 'preview' | 'commit' | null;
  skipReason: FileSkipReason | null;
  /** The backend's outcome for this file, once committed. */
  result: FileImportResult | null;
}

export interface BatchSummary {
  fileCount: number;
  firstMonth: string | null;
  lastMonth: string | null;
  /** Months between `firstMonth` and `lastMonth` (exclusive) with no file in the batch. */
  missingMonths: string[];
  needsAccountCount: number;
}

export interface PreviewProgress {
  done: number;
  total: number;
}

export interface RowPatch {
  merchant?: Merchant | null;
  category?: Category | null;
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

const PREVIEW_CONCURRENCY = 4;
const IMPORT_CHECK_CHUNK = 1000;
const EXCEL_PATTERN = /\.xlsx?$/i;
const EXCEL_ERROR =
  'Excel files (.xls, .xlsx) are not supported. Export the statement as CSV and add it again.';
const PREVIEW_ERROR = 'Could not read this file. Check that the bank format matches the statement.';
const HASH_ERROR = 'Could not read this file from disk.';
const COMMIT_ERROR = 'The import could not be completed. Check your connection and try again.';
const FAILED_RESULT_ERROR = 'This file could not be imported.';
const MISSING_RESULT_ERROR = 'No result was returned for this file. Try again.';

/**
 * Duplicate-detection signature, mirroring the backend's `buildSignature`
 * (`date_amount_description_type`). Only compared between rows of this batch, so it needs to be
 * self-consistent rather than byte-identical to the backend's string.
 */
function signature(preview: TransactionPreview): string {
  return `${preview.date}_${String(preview.amount)}_${preview.description}_${preview.type}`;
}

function toReviewRow(preview: TransactionPreview): ReviewRow {
  const category: Category | null = preview.suggestedCategory ?? null;
  return {
    preview,
    merchant: preview.suggestedMerchant ?? null,
    category,
    origin: category ? 'rule' : 'none',
    skip: null,
  };
}

/**
 * Recomputes every row's skip flag; unchanged rows and files keep their object identity.
 * Committed and skipped files are final: their rows still count as earlier rows, but never change.
 */
function withSkips(files: BatchFile[]): BatchFile[] {
  const seenByAccount = new Map<number, Set<string>>();
  return files.map((file: BatchFile): BatchFile => {
    if (file.rows.length === 0) return file;
    const final: boolean = file.status === 'committed' || file.status === 'skipped';
    let seen: Set<string> | undefined =
      file.accountId === null ? undefined : seenByAccount.get(file.accountId);
    if (!seen) {
      seen = new Set<string>();
      if (file.accountId !== null) seenByAccount.set(file.accountId, seen);
    }
    const earlier: Set<string> = seen;
    const own: string[] = [];
    let changed = false;
    const rows: ReviewRow[] = file.rows.map((row: ReviewRow): ReviewRow => {
      const sig: string = signature(row.preview);
      own.push(sig);
      const skip: ReviewRowSkip = file.alreadyImported
        ? 'file-already-imported'
        : row.preview.duplicate || earlier.has(sig)
          ? 'duplicate'
          : null;
      if (final || skip === row.skip) return row;
      changed = true;
      return { ...row, skip };
    });
    if (!file.alreadyImported) own.forEach((sig: string) => earlier.add(sig));
    return changed ? { ...file, rows } : file;
  });
}

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
}

function previewError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      const detail: unknown = (body as { detail: unknown }).detail;
      if (typeof detail === 'string' && detail.trim()) return `Could not read this file: ${detail}`;
    }
  }
  return PREVIEW_ERROR;
}

/**
 * Component-scoped state for one CSV import batch (PF-898): the chosen files, their account/bank,
 * the previewed review rows with the user's edits, and per-file commit outcomes.
 *
 * Provide it on the import dialog and feed it the user's accounts with {@link setAccounts}.
 * Nothing is saved until {@link commit}.
 *
 * While a commit or retry is in flight the batch is frozen: {@link addFiles}, {@link removeFile},
 * {@link setAccount}, {@link setBank}, {@link applyToSelected} and {@link editRow} do nothing, so
 * each file's outcome always describes exactly what was sent.
 */
@Injectable()
export class CsvImportBatchStore {
  private readonly importService: TransactionImportService = inject(TransactionImportService);

  private readonly accounts: WritableSignal<Account[]> = signal([]);
  private readonly files: WritableSignal<BatchFile[]> = signal([]);
  private readonly previewRunning: WritableSignal<boolean> = signal(false);
  private readonly commitRunning: WritableSignal<boolean> = signal(false);
  private readonly progress: WritableSignal<PreviewProgress> = signal({ done: 0, total: 0 });

  /** Bumped on every preview run and on cancel; a stale run's late results are dropped. */
  private previewRun = 0;
  /** Cancels for in-flight uploads, by file id. */
  private readonly inFlight = new Map<string, () => void>();

  readonly items: Signal<BatchFile[]> = this.files.asReadonly();
  readonly previewing: Signal<boolean> = this.previewRunning.asReadonly();
  readonly committing: Signal<boolean> = this.commitRunning.asReadonly();
  readonly previewProgress: Signal<PreviewProgress> = this.progress.asReadonly();

  readonly canPreview: Signal<boolean> = computed((): boolean => {
    const files: BatchFile[] = this.files();
    return (
      !this.previewRunning() &&
      !this.commitRunning() &&
      files.length > 0 &&
      files.every((f: BatchFile): boolean => f.accountId !== null && f.bankName !== null)
    );
  });

  readonly canCommit: Signal<boolean> = computed((): boolean => {
    const files: BatchFile[] = this.files();
    return (
      !this.previewRunning() &&
      !this.commitRunning() &&
      files.some((f: BatchFile): boolean => f.status === 'ready') &&
      !files.some((f: BatchFile): boolean => f.status === 'pending' || f.status === 'previewing')
    );
  });

  readonly summary: Signal<BatchSummary> = computed((): BatchSummary => {
    const files: BatchFile[] = this.files();
    const months: string[] = [
      ...new Set(
        files
          .map((f: BatchFile): string | null => f.statementMonth)
          .filter((m: string | null): m is string => m !== null),
      ),
    ].sort();
    const firstMonth: string | null = months[0] ?? null;
    const lastMonth: string | null = months[months.length - 1] ?? null;
    const missingMonths: string[] = [];
    if (firstMonth && lastMonth) {
      const present = new Set<string>(months);
      for (let m: string = nextMonth(firstMonth); m < lastMonth; m = nextMonth(m)) {
        if (!present.has(m)) missingMonths.push(m);
      }
    }
    return {
      fileCount: files.length,
      firstMonth,
      lastMonth,
      missingMonths,
      needsAccountCount: files.filter((f: BatchFile): boolean => f.accountId === null).length,
    };
  });

  /** The user's accounts, used by file-name matching. The dialog calls this from its input. */
  setAccounts(accounts: Account[]): void {
    this.accounts.set(accounts);
  }

  /**
   * Adds files, skipping any with the same name and size as one already in the batch.
   * Ignored while a commit is in flight.
   */
  addFiles(files: File[]): void {
    if (this.commitRunning()) return;
    const seen = new Set<string>(
      this.files().map((f: BatchFile): string => `${f.file.name}|${f.file.size}`),
    );
    const added: BatchFile[] = [];
    for (const file of files) {
      const key = `${file.name}|${file.size}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const match: FileMatch = matchFile(file.name, this.accounts());
      added.push({
        id: crypto.randomUUID(),
        file,
        accountId: match.accountId,
        bankName: match.bankName,
        statementMonth: match.statementMonth,
        matchReason: match.reason,
        hash: null,
        alreadyImported: false,
        status: 'pending',
        error: null,
        rows: [],
        discardedEdits: false,
        failedAt: null,
        skipReason: null,
        result: null,
      });
    }
    if (added.length) this.files.update((current: BatchFile[]) => [...current, ...added]);
  }

  /** Removes a file and cancels its upload if one is running. Ignored while committing. */
  removeFile(id: string): void {
    if (this.commitRunning()) return;
    this.inFlight.get(id)?.();
    this.files.update((files: BatchFile[]) =>
      withSkips(files.filter((f: BatchFile): boolean => f.id !== id)),
    );
  }

  /**
   * Sets a file's account; also fills its bank from the account when it has none. A real change
   * to a previewed (or previewing) file sends it back to `'pending'`. Ignored while committing.
   */
  setAccount(id: string, accountId: number | null): void {
    this.assign([id], accountId, undefined);
  }

  /** Sets a file's bank format; same reset rules as {@link setAccount}. Ignored while committing. */
  setBank(id: string, bank: BankName | null): void {
    this.assign([id], undefined, bank);
  }

  /**
   * Applies an account and/or bank to the given files; a null argument leaves that field alone.
   * Ignored while committing.
   */
  applyToSelected(ids: string[], accountId: number | null, bank: BankName | null): void {
    this.assign(ids, accountId ?? undefined, bank ?? undefined);
  }

  /**
   * Previews every file that has not been previewed yet (or whose preview failed), at most
   * {@link PREVIEW_CONCURRENCY} uploads at a time. Ready files are left untouched.
   */
  async previewAll(): Promise<void> {
    if (!this.canPreview()) return;
    const run: number = ++this.previewRun;
    const targets: BatchFile[] = this.files().filter(
      (f: BatchFile): boolean =>
        f.status === 'pending' || (f.status === 'failed' && f.failedAt === 'preview'),
    );
    if (targets.length === 0) return;

    this.previewRunning.set(true);
    this.progress.set({ done: 0, total: targets.length });
    try {
      const uploadable: string[] = [];
      for (const target of targets) {
        if (EXCEL_PATTERN.test(target.file.name)) {
          this.failPreview(target.id, EXCEL_ERROR);
        } else {
          uploadable.push(target.id);
        }
      }

      const hashed: string[] = await this.hashFiles(uploadable);
      if (run !== this.previewRun) return;
      await this.markAlreadyImported(hashed);
      if (run !== this.previewRun) return;

      const queue: string[] = [...hashed];
      const worker = async (): Promise<void> => {
        while (queue.length && run === this.previewRun) {
          await this.previewOne(queue.shift() as string, run);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(PREVIEW_CONCURRENCY, queue.length) }, worker),
      );
    } finally {
      if (run === this.previewRun) this.previewRunning.set(false);
    }
  }

  /** Stops the running preview; files not finished yet go back to `'pending'`. */
  cancelPreview(): void {
    if (!this.previewRunning()) return;
    this.previewRun++;
    [...this.inFlight.values()].forEach((cancel: () => void) => cancel());
    this.inFlight.clear();
    this.files.update((files: BatchFile[]) =>
      files.map((f: BatchFile): BatchFile =>
        f.status === 'previewing' ? { ...f, status: 'pending' } : f,
      ),
    );
    this.previewRunning.set(false);
  }

  /**
   * Changes one row's merchant and/or category. No other row, and no rule, is affected.
   * Ignored while committing, and for committed or skipped files.
   */
  editRow(fileId: string, rowIndex: number, patch: RowPatch): void {
    if (this.commitRunning()) return;
    this.files.update((files: BatchFile[]) =>
      files.map((f: BatchFile): BatchFile => {
        if (f.id !== fileId || !f.rows[rowIndex]) return f;
        if (f.status === 'committed' || f.status === 'skipped') return f;
        const rows: ReviewRow[] = [...f.rows];
        rows[rowIndex] = { ...rows[rowIndex], ...patch, origin: 'edited' };
        return { ...f, rows };
      }),
    );
  }

  /**
   * Commits every ready file in one bulk request. Files with nothing to save (no rows, every row
   * skipped, or already imported) are marked skipped and never sent; with none left, nothing is
   * sent at all.
   * @returns the backend's per-file results (empty when nothing was sent or the request failed).
   */
  async commit(): Promise<FileImportResult[]> {
    if (this.previewRunning() || this.commitRunning()) return [];
    return this.send(
      this.files()
        .filter((f: BatchFile): boolean => f.status === 'ready')
        .map((f: BatchFile): string => f.id),
    );
  }

  /** Re-sends only the files whose commit failed. Committed files are never sent again. */
  async retryFailed(): Promise<void> {
    if (this.previewRunning() || this.commitRunning()) return;
    await this.send(
      this.files()
        .filter((f: BatchFile): boolean => f.status === 'failed' && f.failedAt === 'commit')
        .map((f: BatchFile): string => f.id),
    );
  }

  reset(): void {
    this.cancelPreview();
    this.files.set([]);
    this.progress.set({ done: 0, total: 0 });
  }

  private assign(
    ids: string[],
    accountId: number | null | undefined,
    bank: BankName | null | undefined,
  ): void {
    if (this.commitRunning()) return;
    const targets = new Set<string>(ids);
    const accounts: Account[] = this.accounts();
    const wasPreviewing: string[] = this.files()
      .filter((f: BatchFile): boolean => targets.has(f.id) && f.status === 'previewing')
      .map((f: BatchFile): string => f.id);
    this.files.update((files: BatchFile[]) =>
      withSkips(
        files.map((f: BatchFile): BatchFile => {
          if (!targets.has(f.id) || f.status === 'committed' || f.status === 'skipped') return f;
          const nextAccount: number | null = accountId === undefined ? f.accountId : accountId;
          let nextBank: BankName | null = bank === undefined ? f.bankName : bank;
          if (nextBank === null && nextAccount !== null && accountId !== undefined) {
            nextBank = accounts.find((a: Account): boolean => a.id === nextAccount)?.bank ?? null;
          }
          if (nextAccount === f.accountId && nextBank === f.bankName) return f;
          // the already-imported check was for the old account; never carry it to a new one
          const changed: BatchFile = {
            ...f,
            accountId: nextAccount,
            bankName: nextBank,
            alreadyImported: nextAccount === f.accountId ? f.alreadyImported : false,
          };
          if (f.status === 'pending') return changed;
          return {
            ...changed,
            status: 'pending',
            rows: [],
            alreadyImported: false,
            error: null,
            failedAt: null,
            result: null,
            discardedEdits: f.rows.some((r: ReviewRow): boolean => r.origin === 'edited'),
          };
        }),
      ),
    );
    // an upload for the old account/bank is now useless
    for (const id of wasPreviewing) {
      if (this.find(id)?.status === 'pending') this.inFlight.get(id)?.();
    }
  }

  private patch(id: string, changes: Partial<BatchFile>): void {
    this.files.update((files: BatchFile[]) =>
      files.map((f: BatchFile): BatchFile => (f.id === id ? { ...f, ...changes } : f)),
    );
  }

  private failPreview(id: string, error: string): void {
    this.patch(id, { status: 'failed', failedAt: 'preview', error, rows: [] });
    this.progress.update((p: PreviewProgress) => ({ ...p, done: p.done + 1 }));
  }

  /** Hashes the given files (reusing earlier hashes); returns the ids that have a hash. */
  private async hashFiles(ids: string[]): Promise<string[]> {
    const results: (string | null)[] = await Promise.all(
      ids.map(async (id: string): Promise<string | null> => {
        const file: BatchFile | undefined = this.find(id);
        if (!file) return null;
        if (file.hash) return id;
        try {
          const hash: string = await this.importService.calculateFileHash(file.file);
          this.patch(id, { hash });
          return id;
        } catch {
          this.failPreview(id, HASH_ERROR);
          return null;
        }
      }),
    );
    return results.filter((id: string | null): id is string => id !== null);
  }

  /** One import-check call per {@link IMPORT_CHECK_CHUNK} files; a failed check marks nothing. */
  private async markAlreadyImported(ids: string[]): Promise<void> {
    const pairs: { id: string; accountId: number; fileHash: string }[] = [];
    for (const id of ids) {
      const f: BatchFile | undefined = this.find(id);
      if (f && f.accountId !== null && f.hash) {
        pairs.push({ id, accountId: f.accountId, fileHash: f.hash });
      }
    }
    const found = new Set<string>();
    for (let i = 0; i < pairs.length; i += IMPORT_CHECK_CHUNK) {
      const chunk = pairs
        .slice(i, i + IMPORT_CHECK_CHUNK)
        .map(({ accountId, fileHash }) => ({ accountId, fileHash }));
      try {
        const imported = await firstValueFrom(this.importService.checkAlreadyImported(chunk));
        imported.forEach((p) => found.add(`${p.accountId}|${p.fileHash}`));
      } catch {
        // the backend still refuses a repeated file at commit, so the batch can proceed
      }
    }
    const flagged = new Set<string>(ids);
    this.files.update((files: BatchFile[]) =>
      files.map((f: BatchFile): BatchFile => {
        if (!flagged.has(f.id)) return f;
        const alreadyImported: boolean = found.has(`${f.accountId}|${f.hash}`);
        return alreadyImported === f.alreadyImported ? f : { ...f, alreadyImported };
      }),
    );
  }

  private async previewOne(id: string, run: number): Promise<void> {
    const file: BatchFile | undefined = this.find(id);
    if (!file || file.accountId === null || file.bankName === null) return;
    this.patch(id, { status: 'previewing', error: null, failedAt: null });

    const outcome: Settled<TransactionPreview[]> | null = await this.cancellable(
      id,
      this.importService.uploadCsv(file.accountId, file.file, file.bankName),
    );
    // the whole run was cancelled: its files went back to pending and its progress is moot
    if (run !== this.previewRun) return;
    // the file was changed or removed while uploading: drop the result, but count it as done
    if (!outcome || this.find(id)?.status !== 'previewing') {
      this.progress.update((p: PreviewProgress) => ({ ...p, done: p.done + 1 }));
      return;
    }

    if (outcome.ok) {
      this.files.update((files: BatchFile[]) =>
        withSkips(
          files.map((f: BatchFile): BatchFile =>
            f.id === id ? { ...f, status: 'ready', rows: outcome.value.map(toReviewRow) } : f,
          ),
        ),
      );
      this.progress.update((p: PreviewProgress) => ({ ...p, done: p.done + 1 }));
    } else {
      this.failPreview(id, previewError(outcome.error));
    }
  }

  /** Resolves with the first value or the error, or with null if cancelled first. */
  private cancellable<T>(id: string, source: Observable<T>): Promise<Settled<T> | null> {
    return new Promise((resolve: (value: Settled<T> | null) => void): void => {
      let settled = false;
      const finish = (value: Settled<T> | null): void => {
        if (settled) return;
        settled = true;
        if (this.inFlight.get(id) === cancel) this.inFlight.delete(id);
        resolve(value);
      };
      const cancel = (): void => {
        // only ever called after subscribe() has returned
        subscription.unsubscribe();
        finish(null);
      };
      this.inFlight.set(id, cancel);
      const subscription: Subscription = source.subscribe({
        next: (value: T) => finish({ ok: true, value }),
        error: (error: unknown) => finish({ ok: false, error }),
        complete: () => finish({ ok: false, error: new Error('No response') }),
      });
    });
  }

  private async send(ids: string[]): Promise<FileImportResult[]> {
    const requests: SaveTransactionRequest[] = [];
    const sent: BatchFile[] = [];
    const skipped = new Map<string, FileSkipReason>();

    for (const id of ids) {
      const f: BatchFile | undefined = this.find(id);
      if (!f) continue;
      const committable: ReviewRow[] = f.rows.filter((r: ReviewRow): boolean => r.skip === null);
      if (f.alreadyImported) skipped.set(id, 'already-imported');
      else if (f.rows.length === 0) skipped.set(id, 'no-rows');
      else if (committable.length === 0) skipped.set(id, 'all-duplicates');
      else if (f.accountId !== null && f.hash) {
        sent.push(f);
        requests.push({
          fileName: f.file.name,
          fileHash: f.hash,
          accountId: f.accountId,
          transactions: committable.map((r: ReviewRow): TransactionDto => ({
            date: r.preview.date,
            postDate: r.preview.postDate,
            type: r.preview.type,
            amount: Math.abs(r.preview.amount),
            description: r.preview.description,
            merchant: r.merchant,
            category: r.category,
          })),
        });
      }
    }

    if (skipped.size) {
      this.files.update((files: BatchFile[]) =>
        files.map((f: BatchFile): BatchFile => {
          const skipReason: FileSkipReason | undefined = skipped.get(f.id);
          return skipReason
            ? { ...f, status: 'skipped', skipReason, error: null, failedAt: null }
            : f;
        }),
      );
    }
    if (requests.length === 0) return [];

    this.commitRunning.set(true);
    let results: FileImportResult[];
    try {
      results = await firstValueFrom(this.importService.saveBulkTransactions(requests));
    } catch {
      this.commitRunning.set(false);
      this.applyToSent(
        new Map(
          sent.map((f: BatchFile): [BatchFile, Partial<BatchFile>] => [
            f,
            { status: 'failed', failedAt: 'commit', error: COMMIT_ERROR },
          ]),
        ),
      );
      return [];
    }
    this.commitRunning.set(false);

    // match by file name, consuming each result once (two files can share a name)
    const unmatched: FileImportResult[] = [...results];
    const outcomes = new Map<BatchFile, Partial<BatchFile>>();
    for (const f of sent) {
      const index: number = unmatched.findIndex(
        (r: FileImportResult): boolean => r.fileName === f.file.name,
      );
      const result: FileImportResult | undefined =
        index >= 0 ? unmatched.splice(index, 1)[0] : undefined;
      outcomes.set(f, this.outcome(result));
    }
    this.applyToSent(outcomes);
    return results;
  }

  /**
   * Applies commit outcomes keyed by the exact file snapshot that was sent. Mutators are frozen
   * during a commit, so the snapshot is normally still current; a file that is gone (reset) or
   * no longer identical is left alone rather than given an outcome for something it isn't.
   */
  private applyToSent(outcomes: Map<BatchFile, Partial<BatchFile>>): void {
    this.files.update((files: BatchFile[]) =>
      files.map((f: BatchFile): BatchFile => {
        const changes: Partial<BatchFile> | undefined = outcomes.get(f);
        return changes ? { ...f, ...changes } : f;
      }),
    );
  }

  private outcome(result: FileImportResult | undefined): Partial<BatchFile> {
    if (!result) {
      return { status: 'failed', failedAt: 'commit', error: MISSING_RESULT_ERROR, result: null };
    }
    switch (result.status) {
      case 'IMPORTED':
        return { status: 'committed', failedAt: null, error: null, result };
      case 'SKIPPED_ALREADY_IMPORTED':
        return {
          status: 'skipped',
          skipReason: 'already-imported',
          failedAt: null,
          error: null,
          result,
        };
      default: {
        // a FAILED result arrives inside a 200; `error` may be null or missing entirely
        const error: string | null | undefined = result.error;
        return {
          status: 'failed',
          failedAt: 'commit',
          error: error && error.trim() ? error : FAILED_RESULT_ERROR,
          result,
        };
      }
    }
  }

  private find(id: string): BatchFile | undefined {
    return this.files().find((f: BatchFile): boolean => f.id === id);
  }
}
