import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { formatCurrency } from '@shared/utils/account.utils';

@Component({
  selector: 'app-ytd-summary',
  standalone: true,
  imports: [CommonModule, CardModule, DividerModule],
  templateUrl: './ytd-summary.component.html'
})
export class YtdSummaryComponent {
  year = input.required<number>();
  totalIncome = input.required<number>();
  totalExpense = input.required<number>();
  avgSavingsRate = input.required<number>();

  protected readonly Math = Math;
  formatCurrency = formatCurrency;
}
