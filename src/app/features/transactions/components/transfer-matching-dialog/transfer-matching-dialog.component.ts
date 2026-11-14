import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';

import { TransferSuggestion } from '@models/transaction.model';
import { TransactionApiService } from '../../services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';

/** Matches at or above this confidence are approved together; the rest are reviewed one by one. */
const HIGH_CONFIDENCE = 0.9;

/** A suggestion with the review group it belongs to, for the grouped table. */
export interface SuggestionRow extends TransferSuggestion {
  group: 'Ready to approve' | 'Needs review';
}

/** What the last approval changed, kept so it can be undone. */
interface ApprovedBatch {
  ids: number[];
  items: TransferSuggestion[];
}

/**
 * Intelligent dialog for reconciling potential bank transfers.
 *
 * Uses heuristic matching to identify pairs of transactions across accounts
 * that represent a single transfer of funds, allowing users to consolidate
 * them for accurate reporting.
 */
@Component({
  selector: 'app-transfer-matching-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TableModule,
    TooltipModule,
    TagModule,
    FormatCurrencyPipe,
    RestoreFocusOnHideDirective,
  ],
  templateUrl: './transfer-matching-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferMatchingDialogComponent {
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** Emitted when the matching process is completed. */
  readonly complete: OutputEmitterRef<void> = output<void>();

  /** The list of identified transfer pairs needing review. */
  readonly suggestions: WritableSignal<TransferSuggestion[]> = signal([]);

  /** Indicates if the initial suggestions are being loaded. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Indicates if a matching operation is in flight. */
  readonly processing: WritableSignal<boolean> = signal(false);

  /** The last approval, while it can still be undone. */
  readonly lastApproved: WritableSignal<ApprovedBatch | null> = signal(null);

  /** Suggestions at or above the high-confidence threshold, highest first. */
  readonly highConfidence: Signal<TransferSuggestion[]> = computed((): TransferSuggestion[] =>
    this.suggestions().filter((s: TransferSuggestion): boolean => isHighConfidence(s)),
  );

  /** Rows for the table: high confidence first, each tagged with its group. */
  readonly rows: Signal<SuggestionRow[]> = computed((): SuggestionRow[] => {
    const ordered: TransferSuggestion[] = [...this.suggestions()];
    ordered.sort(
      (a: TransferSuggestion, b: TransferSuggestion): number =>
        b.confidenceScore - a.confidenceScore,
    );
    return ordered.map((s: TransferSuggestion): SuggestionRow => ({
      ...s,
      group: isHighConfidence(s) ? 'Ready to approve' : 'Needs review',
    }));
  });

  /** The footer button names how many pairs it will approve. */
  readonly approveAllLabel: Signal<string> = computed((): string => {
    const count: number = this.highConfidence().length;
    return count === 0 ? 'Approve pairs' : `Approve ${count} ${count === 1 ? 'pair' : 'pairs'}`;
  });

  protected readonly Math = Math;

  constructor() {
    /**
     * Effect to reactively fetch suggestions whenever the dialog is opened.
     */
    effect((): void => {
      if (this.visible()) {
        this.loadSuggestions();
      }
    });
  }

  /**
   * Fetches potential transfer matches from the API.
   */
  private loadSuggestions(): void {
    this.loading.set(true);
    this.transactionApi.getTransferSuggestions().subscribe({
      next: (data: TransferSuggestion[]): void => {
        this.suggestions.set(dedupeMirroredPairs(data));
        this.lastApproved.set(null);
        this.loading.set(false);
      },
      error: (): void => {
        this.toast.error('Failed to analyze transfer patterns.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Closes the dialog.
   */
  onHide(): void {
    this.visible.set(false);
  }

  /**
   * Confirms a single transfer pair.
   * @param suggestion - The pair to match.
   */
  confirmMatch(suggestion: TransferSuggestion): void {
    this.processMatch([suggestion]);
  }

  /**
   * Approves every high-confidence pair. Lower-confidence matches stay in the list for a
   * one-by-one decision, since each approval changes the income and expense totals.
   */
  confirmAll(): void {
    this.processMatch(this.highConfidence());
  }

  /**
   * Orchestrates the persistence of transfer matches to the backend.
   * @param items - The list of pairs to finalize.
   */
  private processMatch(items: TransferSuggestion[]): void {
    if (items.length === 0) return;

    this.processing.set(true);
    const ids: number[] = items.flatMap((s: TransferSuggestion): number[] => [
      s.sourceTransaction.id,
      s.targetTransaction.id,
    ]);

    this.transactionApi.markAsTransfer(ids).subscribe({
      next: (): void => {
        this.toast.success(
          `Approved ${items.length} transfer ${items.length === 1 ? 'pair' : 'pairs'}`,
        );

        const processedIds = new Set(ids);
        this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] =>
          current.filter(
            (s: TransferSuggestion): boolean =>
              !processedIds.has(s.sourceTransaction.id) &&
              !processedIds.has(s.targetTransaction.id),
          ),
        );

        this.lastApproved.set({ ids, items });
        this.processing.set(false);
        this.complete.emit();
      },
      error: (): void => {
        this.toast.error('Could not approve the transfers', 'Nothing was changed. Try again.');
        this.processing.set(false);
      },
    });
  }

  /** Reverses the last approval and puts its pairs back in the list. */
  undoLastApproval(): void {
    const batch: ApprovedBatch | null = this.lastApproved();
    if (batch === null) return;

    this.processing.set(true);
    this.transactionApi.unmarkAsTransfer(batch.ids).subscribe({
      next: (): void => {
        this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] => [
          ...current,
          ...batch.items,
        ]);
        this.lastApproved.set(null);
        this.processing.set(false);
        this.toast.success('Approval undone', 'The pairs are back in the list.');
        this.complete.emit();
      },
      error: (): void => {
        this.toast.error('Could not undo the approval', 'The transfers are still approved.');
        this.processing.set(false);
      },
    });
  }

  /**
   * Removes a suggestion from the active review list without taking action.
   */
  ignoreMatch(suggestion: TransferSuggestion): void {
    this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] =>
      current.filter(
        (s: TransferSuggestion): boolean =>
          s.sourceTransaction.id !== suggestion.sourceTransaction.id ||
          s.targetTransaction.id !== suggestion.targetTransaction.id,
      ),
    );
  }
}

function isHighConfidence(suggestion: TransferSuggestion): boolean {
  return suggestion.confidenceScore >= HIGH_CONFIDENCE;
}

/**
 * The matcher can report one transfer twice, once per direction (A to B and B to A). Keep one
 * entry per pair of transactions, preferring the higher confidence.
 */
function dedupeMirroredPairs(data: TransferSuggestion[]): TransferSuggestion[] {
  const byPair = new Map<string, TransferSuggestion>();
  for (const suggestion of data) {
    const a: number = suggestion.sourceTransaction.id;
    const b: number = suggestion.targetTransaction.id;
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const existing: TransferSuggestion | undefined = byPair.get(key);
    if (existing === undefined || suggestion.confidenceScore > existing.confidenceScore) {
      byPair.set(key, suggestion);
    }
  }
  return [...byPair.values()];
}
