import {
  Component,
  effect,
  inject,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {DialogModule} from 'primeng/dialog';
import {TableModule} from 'primeng/table';
import {TooltipModule} from 'primeng/tooltip';
import {TagModule} from 'primeng/tag';

import {TransferSuggestion} from '@models/transaction.model';
import {TransactionApiService} from '../../services/transaction-api.service';
import {ToastService} from '@core/services/toast.service';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

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
    FormatCurrencyPipe
  ],
  templateUrl: './transfer-matching-dialog.component.html'
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
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: (): void => {
        this.toast.error('Failed to analyze transfer patterns.');
        this.loading.set(false);
      }
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
   * Mass-confirms all identified transfer pairs.
   */
  confirmAll(): void {
    this.processMatch(this.suggestions());
  }

  /**
   * Orchestrates the persistence of transfer matches to the backend.
   * @param items - The list of pairs to finalize.
   */
  private processMatch(items: TransferSuggestion[]): void {
    if (items.length === 0) return;

    this.processing.set(true);
    const ids: number[] = items.flatMap((s: TransferSuggestion): number[] => [s.sourceTransaction.id, s.targetTransaction.id]);

    this.transactionApi.markAsTransfer(ids).subscribe({
      next: (): void => {
        this.toast.success(`Synchronized ${items.length} transfer pairs.`);

        const processedIds = new Set(ids);
        this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] =>
          current.filter((s: TransferSuggestion): boolean => !processedIds.has(s.sourceTransaction.id) && !processedIds.has(s.targetTransaction.id))
        );

        this.processing.set(false);
        this.complete.emit();

        if (this.suggestions().length === 0) {
          this.onHide();
        }
      },
      error: (): void => {
        this.toast.error('Failed to synchronize transfers.');
        this.processing.set(false);
      }
    });
  }

  /**
   * Removes a suggestion from the active review list without taking action.
   */
  ignoreMatch(suggestion: TransferSuggestion): void {
    this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] => current.filter((s: TransferSuggestion): boolean => s !== suggestion));
  }
}
