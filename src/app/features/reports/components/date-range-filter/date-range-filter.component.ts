import {ChangeDetectionStrategy, Component, effect, model, ModelSignal, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DatePicker} from 'primeng/datepicker';
import {Button} from 'primeng/button';
import {DateRange, DateRangePreset} from '../../models/reports.model';
import {fromLocalDateString, toLocalDateString} from '@shared/utils/transaction.utils';

/**
 * Component for selecting and managing date range filters for reports.
 *
 * Provides quick-action presets (e.g., YTD, Last 3 Months) and a
 * custom range picker for precise temporal analysis.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, Button],
  templateUrl: './date-range-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateRangeFilterComponent {
  /** Two-way binding for the currently selected date range. */
  readonly dateRange: ModelSignal<DateRange> = model.required<DateRange>();

  /** Buffer signal for the PrimeNG date picker range array. */
  protected readonly selectedRange: WritableSignal<Date[] | null> = signal(null);

  /** List of predefined range presets for rapid filtering. */
  protected readonly presets: DateRangePreset[] = [
    {label: 'This Month', getValue: (): DateRange => this.getThisMonth()},
    {label: 'Last Month', getValue: (): DateRange => this.getLastMonth()},
    {label: 'Last 3 Months', getValue: (): DateRange => this.getLast3Months()},
    {label: 'YTD', getValue: (): DateRange => this.getYTD()},
    {label: 'Last Year', getValue: (): DateRange => this.getLastYear()}
  ];

  constructor() {
    /**
     * Synchronizes the internal date picker buffer whenever the
     * external model changes (e.g., via a preset or parent update).
     */
    effect((): void => {
      const range: DateRange = this.dateRange();
      if (range) {
        this.selectedRange.set([fromLocalDateString(range.startDate), fromLocalDateString(range.endDate)]);
      }
    });
  }

  /**
   * Handles clicking a preset button.
   * @param preset - The selected preset configuration.
   */
  protected onPresetClick(preset: DateRangePreset): void {
    this.dateRange.set(preset.getValue());
  }

  /**
   * Handles direct date selection in the range picker.
   */
  protected onDateSelect(): void {
    const dates: Date[] | null = this.selectedRange();

    if (dates?.length === 2 && dates[0] && dates[1]) {
      this.dateRange.set({
        startDate: toLocalDateString(dates[0]),
        endDate: toLocalDateString(dates[1]),
        label: 'Custom Range'
      });
    }
  }

  private getThisMonth(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {startDate: toLocalDateString(start), endDate: toLocalDateString(now), label: 'This Month'};
  }

  private getLastMonth(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {startDate: toLocalDateString(start), endDate: toLocalDateString(end), label: 'Last Month'};
  }

  private getLast3Months(): DateRange {
    const now = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    return {startDate: toLocalDateString(start), endDate: toLocalDateString(now), label: 'Last 3 Months'};
  }

  private getYTD(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return {startDate: toLocalDateString(start), endDate: toLocalDateString(now), label: 'Year to Date'};
  }

  private getLastYear(): DateRange {
    const start = new Date(new Date().getFullYear() - 1, 0, 1);
    const end = new Date(new Date().getFullYear() - 1, 11, 31);
    return {startDate: toLocalDateString(start), endDate: toLocalDateString(end), label: 'Last Year'};
  }
}
