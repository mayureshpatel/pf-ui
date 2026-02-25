import {Component, input, InputSignal} from '@angular/core';
import {CardModule} from 'primeng/card';
import {DashboardData} from '@models/dashboard.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CardModule, FormatCurrencyPipe, NgClass],
  templateUrl: './summary-cards.component.html'
})
export class SummaryCardsComponent {
  data: InputSignal<DashboardData | null> = input.required<DashboardData | null>();
}
