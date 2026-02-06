import {Component, input} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {DashboardData} from '@models/dashboard.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CommonModule, CardModule, FormatCurrencyPipe],
  templateUrl: './summary-cards.component.html'
})
export class SummaryCardsComponent {
  data = input.required<DashboardData | null>();
  protected readonly formatCurrency = formatCurrency;
}
