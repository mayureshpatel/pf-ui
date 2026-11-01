import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';

import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { TransferSuggestion } from '@models/transaction.model';
import { BatchFile, CsvImportBatchStore, ReviewRow } from './csv-import-batch.store';

type OutcomeKind = 'imported' | 'skipped' | 'failed' | 'not-imported';

interface FileOutcome {
  id: string;
  name: string;
  kind: OutcomeKind;
  label: string;
  icon: string;
  tone: string;
  /** Counts line, e.g. `2 transactions saved, 1 duplicate skipped`; empty when there is none. */
  detail: string;
  error: string | null;
  saved: number;
  duplicates: number;
}

const TONE: Record<OutcomeKind, { icon: string; tone: string }> = {
  imported: { icon: 'pi-check-circle', tone: 'text-emerald-700 dark:text-emerald-400' },
  skipped: { icon: 'pi-minus-circle', tone: 'text-surface-700 dark:text-surface-200' },
  failed: { icon: 'pi-times-circle', tone: 'text-rose-700 dark:text-rose-400' },
  'not-imported': { icon: 'pi-minus-circle', tone: 'text-surface-700 dark:text-surface-200' },
};

const SKIP_LABEL: Record<NonNullable<BatchFile['skipReason']>, string> = {
  'already-imported': 'Skipped: already imported',
  'no-rows': 'Skipped: no transactions in file',
  'all-duplicates': 'Skipped: no new transactions',
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Rows not sent because they duplicate a saved transaction or an earlier file in the batch, plus
 * the rows the backend skipped as duplicates. Client-skipped rows are never sent, so the backend's
 * `duplicateRowCount` alone would miss them.
 */
function duplicatesOf(file: BatchFile): number {
  const local: number = file.rows.filter((r: ReviewRow): boolean => r.skip === 'duplicate').length;
  return local + (file.result?.duplicateRowCount ?? 0);
}

function outcomeOf(file: BatchFile): FileOutcome {
  const saved: number = file.status === 'committed' ? (file.result?.savedCount ?? 0) : 0;
  const duplicates: number = file.status === 'failed' ? 0 : duplicatesOf(file);
  let kind: OutcomeKind;
  let label: string;
  switch (file.status) {
    case 'committed':
      kind = 'imported';
      label = 'Imported';
      break;
    case 'skipped':
      kind = 'skipped';
      label = file.skipReason ? SKIP_LABEL[file.skipReason] : 'Skipped';
      break;
    case 'failed':
      kind = 'failed';
      label = file.failedAt === 'preview' ? 'Failed: could not be read' : 'Failed';
      break;
    default:
      kind = 'not-imported';
      label = 'Not imported';
  }
  const parts: string[] = [];
  if (kind === 'imported') parts.push(`${plural(saved, 'transaction', 'transactions')} saved`);
  if (duplicates > 0) parts.push(`${plural(duplicates, 'duplicate', 'duplicates')} skipped`);
  return {
    id: file.id,
    name: file.file.name,
    kind,
    label,
    ...TONE[kind],
    detail: parts.join(', '),
    error: kind === 'failed' ? file.error : null,
    saved,
    duplicates,
  };
}

/**
 * Step 3 of the CSV import dialog: what happened to each file once the batch was committed
 * (imported, skipped and why, or failed and why), a retry for files whose commit failed, and a
 * non-blocking offer to review the transfers the import may have created.
 */
@Component({
  selector: 'app-csv-import-result-step',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './csv-import-result-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvImportResultStepComponent {
  private readonly store: CsvImportBatchStore = inject(CsvImportBatchStore);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);

  /** The user chose to review the possible transfers now. */
  readonly reviewTransfers: OutputEmitterRef<void> = output<void>();

  /** Possible transfers from the existing suggestions endpoint; 0 also when the call failed. */
  readonly transferCount: WritableSignal<number> = signal(0);

  readonly committing: Signal<boolean> = this.store.committing;

  readonly outcomes: Signal<FileOutcome[]> = computed((): FileOutcome[] =>
    this.store.items().map(outcomeOf),
  );

  /** Files whose commit failed; files that could not be read need fixing, not retrying. */
  readonly retryableCount: Signal<number> = computed(
    (): number =>
      this.store
        .items()
        .filter((f: BatchFile): boolean => f.status === 'failed' && f.failedAt === 'commit').length,
  );

  readonly summaryText: Signal<string> = computed((): string => {
    const all: FileOutcome[] = this.outcomes();
    const count = (kind: OutcomeKind): number =>
      all.filter((o: FileOutcome): boolean => o.kind === kind).length;
    const saved: number = all.reduce((sum: number, o: FileOutcome): number => sum + o.saved, 0);
    const duplicates: number = all.reduce(
      (sum: number, o: FileOutcome): number => sum + o.duplicates,
      0,
    );
    const details: string[] = [
      plural(saved, 'transaction', 'transactions'),
      `${plural(duplicates, 'duplicate', 'duplicates')} skipped`,
    ];
    if (count('skipped') > 0) details.push(`${plural(count('skipped'), 'file', 'files')} skipped`);
    if (count('failed') > 0) details.push(`${count('failed')} failed`);
    if (count('not-imported') > 0) details.push(`${count('not-imported')} not imported`);
    return `${count('imported')} of ${plural(all.length, 'file', 'files')} imported - ${details.join(', ')}`;
  });

  constructor() {
    // fetched once, after the commit: the step is only shown once every file has finished
    this.transactionApi
      .getTransferSuggestions()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (suggestions: TransferSuggestion[]): void =>
          this.transferCount.set(suggestions.length),
        error: (): void => this.transferCount.set(0),
      });
  }

  retryFailed(): void {
    void this.store.retryFailed();
  }

  onReviewTransfers(): void {
    this.reviewTransfers.emit();
  }
}
