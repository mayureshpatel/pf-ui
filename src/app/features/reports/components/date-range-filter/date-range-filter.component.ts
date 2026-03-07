import {Component, effect, model, ModelSignal, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DatePicker} from 'primeng/datepicker';
import {Button} from 'primeng/button';
import {DateRange, DateRangePreset} from '../../models/reports.model';

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
  templateUrl: './date-range-filter.component.html'
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
        this.selectedRange.set([new Date(range.startDate), new Date(range.endDate)]);
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
        startDate: this.formatDateToISO(dates[0]),
        endDate: this.formatDateToISO(dates[1]),
        label: 'Custom Range'
      });
    }
  }

  /**
   * Utility to format local dates into API-ready ISO strings.
   */
  private formatDateToISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getThisMonth(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {startDate: this.formatDateToISO(start), endDate: this.formatDateToISO(now), label: 'This Month'};
  }

  private getLastMonth(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {startDate: this.formatDateToISO(start), endDate: this.formatDateToISO(end), label: 'Last Month'};
  }

  private getLast3Months(): DateRange {
    const now = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    return {startDate: this.formatDateToISO(start), endDate: this.formatDateToISO(now), label: 'Last 3 Months'};
  }

  private getYTD(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return {startDate: this.formatDateToISO(start), endDate: this.formatDateToISO(now), label: 'Year to Date'};
  }

  private getLastYear(): DateRange {
    const start = new Date(new Date().getFullYear() - 1, 0, 1);
    const end = new Date(new Date().getFullYear() - 1, 11, 31);
    return {startDate: this.formatDateToISO(start), endDate: this.formatDateToISO(end), label: 'Last Year'};
  }
}
