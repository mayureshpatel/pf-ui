import {Component, input, InputSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {DividerModule} from 'primeng/divider';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-ytd-summary',
  standalone: true,
  imports: [CommonModule, CardModule, DividerModule, FormatCurrencyPipe],
  templateUrl: './ytd-summary.component.html'
})
export class YtdSummaryComponent {
  year: InputSignal<number> = input.required<number>();
  totalIncome: InputSignal<number> = input.required<number>();
  totalExpense: InputSignal<number> = input.required<number>();
  avgSavingsRate: InputSignal<number> = input.required<number>();

  protected readonly Math = Math;
}
