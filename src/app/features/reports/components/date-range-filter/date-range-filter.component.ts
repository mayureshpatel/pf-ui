import { Component, input, output, signal, WritableSignal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Button } from 'primeng/button';
import { DateRange, DateRangePreset } from '../../models/reports.model';

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker, Button],
  templateUrl: './date-range-filter.component.html'
})
export class DateRangeFilterComponent {
  dateRange = input.required<DateRange>();
  rangeChange = output<DateRange>();

  protected selectedRange: WritableSignal<Date[] | null> = signal(null);

  protected presets: DateRangePreset[] = [
    { label: 'This Month', getValue: () => this.getThisMonth() },
    { label: 'Last Month', getValue: () => this.getLastMonth() },
    { label: 'Last 3 Months', getValue: () => this.getLast3Months() },
    { label: 'YTD', getValue: () => this.getYTD() },
    { label: 'Last Year', getValue: () => this.getLastYear() }
  ];

  constructor() {
    // Sync selectedRange when dateRange input changes
    effect(() => {
      const range = this.dateRange();
      if (range) {
        const startDate = new Date(range.startDate);
        const endDate = new Date(range.endDate);
        this.selectedRange.set([startDate, endDate]);
      }
    });
  }

  protected onPresetClick(preset: DateRangePreset): void {
    const range = preset.getValue();
    this.rangeChange.emit(range);
  }

  protected onDateSelect(): void {
    const dates = this.selectedRange();

    if (dates && dates.length === 2 && dates[0] && dates[1]) {
      const startDate = this.formatDateToISO(dates[0]);
      const endDate = this.formatDateToISO(dates[1]);

      this.rangeChange.emit({
        startDate,
        endDate,
        label: 'Custom Range'
      });
    }
  }

  private formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getThisMonth(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = now;

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'This Month'
    };
  }

  private getLastMonth(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'Last Month'
    };
  }

  private getLast3Months(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const endDate = now;

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
      label: 'Last 3 Months'
    };
  }

  private getYTD(): DateRange {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    const endDate = now;

    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate),
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
