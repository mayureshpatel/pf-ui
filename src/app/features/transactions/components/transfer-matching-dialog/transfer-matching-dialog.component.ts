import { Component, EventEmitter, input, Output, inject, signal, WritableSignal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { TransferSuggestion } from '@models/transaction.model';
import { TransactionApiService } from '../../services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency } from '@shared/utils/account.utils';
import { formatDate } from '@shared/utils/transaction.utils';

@Component({
  selector: 'app-transfer-matching-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TableModule,
    TooltipModule,
    TagModule
  ],
  templateUrl: './transfer-matching-dialog.component.html'
})
export class TransferMatchingDialogComponent {
  private readonly transactionApi = inject(TransactionApiService);
  private readonly toast = inject(ToastService);

  visible = input.required<boolean>();
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() matchComplete = new EventEmitter<void>();

  suggestions: WritableSignal<TransferSuggestion[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  processing: WritableSignal<boolean> = signal(false);

  formatCurrency = formatCurrency;
  formatDate = formatDate;
  Math = Math;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.loadSuggestions();
      }
    });
  }

  loadSuggestions(): void {
    this.loading.set(true);
    this.transactionApi.getTransferSuggestions().subscribe({
      next: (data) => {
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: () => {
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
    const ids = items.flatMap(s => [s.sourceTransaction.id, s.targetTransaction.id]);

    this.transactionApi.markAsTransfer(ids).subscribe({
      next: () => {
        this.toast.success(`Successfully matched ${items.length} transfer(s)`);
        
        // Remove processed items from list
        const processedIds = new Set(ids);
        this.suggestions.update(current => 
          current.filter(s => 
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
      error: () => {
        this.toast.error('Failed to update transactions');
        this.processing.set(false);
      }
    });
  }

  ignoreMatch(suggestion: TransferSuggestion): void {
    this.suggestions.update(current => current.filter(s => s !== suggestion));
  }
}
