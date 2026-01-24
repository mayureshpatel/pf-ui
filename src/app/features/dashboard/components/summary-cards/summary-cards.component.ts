import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { DashboardData } from '@models/dashboard.model';
import { formatCurrency } from '@shared/utils/account.utils';

@Component({
  selector: 'app-summary-cards',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './summary-cards.component.html'
})
export class SummaryCardsComponent {
  data = input.required<DashboardData | null>();

  formatCurrency = formatCurrency;
}
