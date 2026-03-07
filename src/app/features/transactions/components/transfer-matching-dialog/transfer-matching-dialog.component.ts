import {
  Component,
  effect,
  inject,
  input,
  InputSignal,
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
import {convertDateString} from '@shared/utils/transaction.utils';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

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
  // injected services
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  matchComplete: OutputEmitterRef<void> = output<void>();

  // state
  suggestions: WritableSignal<TransferSuggestion[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  processing: WritableSignal<boolean> = signal(false);

  formatDate = convertDateString;
  Math = Math;

  constructor() {
    effect((): void => {
      if (this.visible()) {
        this.loadSuggestions();
      }
    });
  }

  loadSuggestions(): void {
    this.loading.set(true);
    this.transactionApi.getTransferSuggestions().subscribe({
      next: (data: TransferSuggestion[]): void => {
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: (): void => {
        this.toast.error('Failed to load transfer suggestions');
        this.loading.set(false);
      }
    });
  }

  onHide(): void {
    this.visibleChange.emit(false);
  }

  confirmMatch(suggestion: TransferSuggestion): void {
    this.processMatch([suggestion]);
  }

  confirmAll(): void {
    this.processMatch(this.suggestions());
  }

  private processMatch(items: TransferSuggestion[]): void {
    if (items.length === 0) return;

    this.processing.set(true);
    const ids: number[] = items.flatMap((s: TransferSuggestion): number[] => [s.sourceTransaction.id, s.targetTransaction.id]);

    this.transactionApi.markAsTransfer(ids).subscribe({
      next: (): void => {
        this.toast.success(`Successfully matched ${items.length} transfer(s)`);

        // Remove processed items from list
        const processedIds = new Set(ids);
        this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] =>
          current.filter((s: TransferSuggestion): boolean =>
            !processedIds.has(s.sourceTransaction.id) &&
            !processedIds.has(s.targetTransaction.id)
          )
        );

        this.processing.set(false);
        this.matchComplete.emit();

        if (this.suggestions().length === 0) {
          this.onHide();
        }
      },
      error: (): void => {
        this.toast.error('Failed to update transactions');
        this.processing.set(false);
      }
    });
  }

  ignoreMatch(suggestion: TransferSuggestion): void {
    this.suggestions.update((current: TransferSuggestion[]): TransferSuggestion[] => current.filter((s: TransferSuggestion): boolean => s !== suggestion));
  }
}
