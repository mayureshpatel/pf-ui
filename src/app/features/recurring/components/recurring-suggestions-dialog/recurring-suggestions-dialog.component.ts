import {Component, inject, input, InputSignal, OnChanges, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {TagModule} from 'primeng/tag';
import {TableModule} from 'primeng/table';
import {MessageModule} from 'primeng/message';
import {RecurringSuggestion} from '@models/recurring.model';
import {RecurringApiService} from '../../services/recurring-api.service';
import {ToastService} from '@core/services/toast.service';

@Component({
  selector: 'app-recurring-suggestions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TagModule,
    TableModule,
    MessageModule
  ],
  templateUrl: './recurring-suggestions-dialog.component.html'
})
export class RecurringSuggestionsDialogComponent implements OnChanges {
  private readonly recurringApi = inject(RecurringApiService);
  private readonly toast = inject(ToastService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  suggestionAccepted: OutputEmitterRef<RecurringSuggestion> = output<RecurringSuggestion>();

  // signals
  suggestions: WritableSignal<RecurringSuggestion[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);

  readonly frequencyLabels: Record<string, string> = {
    WEEKLY: 'Weekly',
    BI_WEEKLY: 'Bi-Weekly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    YEARLY: 'Yearly'
  };

  ngOnChanges(): void {
    if (this.visible()) {
      this.loadSuggestions();
    }
  }

  private loadSuggestions(): void {
    this.loading.set(true);
    this.recurringApi.getSuggestions().subscribe({
      next: (data: RecurringSuggestion[]): void => {
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: (error: any): void => {
        console.error('Failed to load suggestions:', error);
        this.toast.error('Failed to load recurring suggestions');
        this.loading.set(false);
      }
    });
  }

  onAccept(suggestion: RecurringSuggestion): void {
    this.suggestionAccepted.emit(suggestion);
    this.onHide();
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.suggestions.set([]);
  }
}
