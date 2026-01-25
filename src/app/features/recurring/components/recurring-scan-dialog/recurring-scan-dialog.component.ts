import { Component, EventEmitter, inject, input, Output, signal, WritableSignal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { RecurringSuggestion, RecurringTransactionDto } from '@models/recurring.model';
import { RecurringApiService } from '../../services/recurring-api.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency } from '@shared/utils/account.utils';
import { formatDate } from '@shared/utils/transaction.utils';

@Component({
  selector: 'app-recurring-scan-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TableModule,
    TagModule
  ],
  templateUrl: './recurring-scan-dialog.component.html'
})
export class RecurringScanDialogComponent {
  private readonly api = inject(RecurringApiService);
  private readonly toast = inject(ToastService);

  visible = input.required<boolean>();
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<void>();

  suggestions: WritableSignal<RecurringSuggestion[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  processing: WritableSignal<boolean> = signal(false);

  formatCurrency = formatCurrency;
  formatDate = formatDate;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.loadSuggestions();
      }
    });
  }

  loadSuggestions(): void {
    this.loading.set(true);
    this.api.getSuggestions().subscribe({
      next: (data) => {
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to find patterns');
        this.loading.set(false);
      }
    });
  }

  onHide(): void {
    this.visibleChange.emit(false);
  }

  confirm(suggestion: RecurringSuggestion): void {
    this.processing.set(true);
    
    const dto: RecurringTransactionDto = {
      merchantName: suggestion.merchantName,
      amount: suggestion.amount,
      frequency: suggestion.frequency,
      lastDate: suggestion.lastDate,
      nextDate: suggestion.nextDate,
      active: true
    };

    this.api.createRecurringTransaction(dto).subscribe({
      next: () => {
        this.toast.success('Added ' + suggestion.merchantName);
        this.suggestions.update(current => 
          current.filter(s => s.merchantName !== suggestion.merchantName)
        );
        this.save.emit();
        this.processing.set(false);
        
        if (this.suggestions().length === 0) {
          this.onHide();
        }
      },
      error: () => {
        this.toast.error('Failed to add recurring transaction');
        this.processing.set(false);
      }
    });
  }

  ignore(suggestion: RecurringSuggestion): void {
    this.suggestions.update(current => 
      current.filter(s => s.merchantName !== suggestion.merchantName)
    );
  }
}
