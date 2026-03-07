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
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {TagModule} from 'primeng/tag';
import {TableModule} from 'primeng/table';
import {MessageModule} from 'primeng/message';
import {TooltipModule} from 'primeng/tooltip';

import {RecurringSuggestion} from '@models/recurring.model';
import {RecurringApiService} from '../../services/recurring-api.service';
import {ToastService} from '@core/services/toast.service';

/**
 * Dialog component for reviewing detected recurring patterns.
 *
 * Scans transaction history to suggest potential recurring entries
 * (e.g., Netflix, Rent, Utility bills) that the user can automate.
 */
@Component({
  selector: 'app-recurring-suggestions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TagModule,
    TableModule,
    MessageModule,
    TooltipModule
  ],
  templateUrl: './recurring-suggestions-dialog.component.html'
})
export class RecurringSuggestionsDialogComponent {
  private readonly recurringApi: RecurringApiService = inject(RecurringApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** Emitted when a user selects a suggestion to be converted into a recurring entry. */
  readonly suggestionAccepted: OutputEmitterRef<RecurringSuggestion> = output<RecurringSuggestion>();

  /** The list of detected patterns from the API. */
  readonly suggestions: WritableSignal<RecurringSuggestion[]> = signal([]);

  /** Indicates if the pattern detection engine is running. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Human-readable labels for frequency constants. */
  readonly frequencyLabels: Record<string, string> = {
    WEEKLY: 'Weekly',
    BI_WEEKLY: 'Bi-Weekly',
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    YEARLY: 'Yearly'
  };

  constructor() {
    /**
     * Effect to automatically fetch suggestions whenever the dialog is opened.
     */
    effect((): void => {
      if (this.visible()) {
        this.loadSuggestions();
      }
    });
  }

  /**
   * Fetches recurring pattern suggestions from the backend service.
   */
  private loadSuggestions(): void {
    this.loading.set(true);
    this.recurringApi.getSuggestions().subscribe({
      next: (data: RecurringSuggestion[]): void => {
        this.suggestions.set(data);
        this.loading.set(false);
      },
      error: (err: any): void => {
        console.error('Failed to detect recurring patterns:', err);
        this.toast.error('Could not load recurring suggestions.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Accepts a suggestion and triggers the main form dialog for final review.
   * @param suggestion - The pattern chosen by the user.
   */
  onAccept(suggestion: RecurringSuggestion): void {
    this.suggestionAccepted.emit(suggestion);
    this.onHide();
  }

  /**
   * Closes the dialog and clears the suggestions buffer.
   */
  onHide(): void {
    this.visible.set(false);
    this.suggestions.set([]);
  }

  /**
   * Returns a semantic class based on the pattern confidence score.
   * @param score - The probability score (0-100).
   */
  getConfidenceStyle(score: number): string {
    if (score >= 90) {
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 ring-emerald-200/50';
    }

    if (score >= 70) {
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 ring-amber-200/50';
    }

    return 'text-surface-500 dark:bg-surface-800 ring-surface-200';
  }
}
