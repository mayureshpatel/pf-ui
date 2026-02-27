import {Component, effect, input, InputSignal, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DatePicker} from 'primeng/datepicker';
import {Button} from 'primeng/button';
import {DateRange, DateRangePreset} from '../../models/reports.model';

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, Button],
  templateUrl: './date-range-filter.component.html'
})
export class DateRangeFilterComponent {
  // input signals
  dateRange: InputSignal<DateRange> = input.required<DateRange>();

  // output signals
  rangeChange: OutputEmitterRef<DateRange> = output<DateRange>();

  // signals
  protected selectedRange: WritableSignal<Date[] | null> = signal(null);

  protected presets: DateRangePreset[] = [
    {label: 'This Month', getValue: (): DateRange => this.getThisMonth()},
    {label: 'Last Month', getValue: (): DateRange => this.getLastMonth()},
    {label: 'Last 3 Months', getValue: (): DateRange => this.getLast3Months()},
    {label: 'YTD', getValue: (): DateRange => this.getYTD()},
    {label: 'Last Year', getValue: (): DateRange => this.getLastYear()}
  ];

  constructor() {
    // Sync selectedRange when dateRange input changes
    effect((): void => {
      const range: DateRange = this.dateRange();

      if (range) {
        const startDate = new Date(range.startDate);
        const endDate = new Date(range.endDate);
        this.selectedRange.set([startDate, endDate]);
      }
    });
  }

  protected onPresetClick(preset: DateRangePreset): void {
    const range: DateRange = preset.getValue();

    this.rangeChange.emit(range);
  }

  protected onDateSelect(): void {
    const dates: Date[] | null = this.selectedRange();

    if (dates?.length === 2 && dates[0] && dates[1]) {
      const startDate: string = this.formatDateToISO(dates[0]);
      const endDate: string = this.formatDateToISO(dates[1]);

      this.rangeChange.emit({
        startDate,
        endDate,
        label: 'Custom Range'
      });
    }
  }

  private formatDateToISO(date: Date): string {
    const year: number = date.getFullYear();
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private getThisMonth(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(now),
      label: 'This Month'
    };
  }

  private getLastMonth(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'Last Month'
    };
  }

  private getLast3Months(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(now),
      label: 'Last 3 Months'
    };
  }

  private getYTD(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(now),
      label: 'Year to Date'
    };
  }

  private getLastYear(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, 0, 1); // Jan 1 of last year
    const endDate = new Date(now.getFullYear() - 1, 11, 31); // Dec 31 of last year

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'Last Year'
    };
  }
}
