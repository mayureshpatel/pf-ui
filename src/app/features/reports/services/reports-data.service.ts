import {Injectable} from '@angular/core';
import {Transaction, TransactionType} from '@models/transaction.model';
import {CategoryReportData, MonthlyReportData, VendorReportData} from '../models/reports.model';
import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

/**
 * Service responsible for aggregating and transforming raw transaction data
 * into report-ready formats.
 */
@Injectable({
  providedIn: 'root'
})
export class ReportsDataService {

  /**
   * Aggregates total spending and transaction counts by category.
   *
   * Filters out internal transfers and focuses exclusively on expense transactions.
   *
   * @param transactions - The array of transactions to analyze.
   * @returns An array of CategoryReportData objects sorted by highest spending.
   */
  aggregateByCategory(transactions: Transaction[]): CategoryReportData[] {
    const categoryMap = new Map<number, { category: Category; total: number; count: number }>();

    for (const txn of transactions) {
      // Only include expenses for category analysis
      if (txn.type === TransactionType.EXPENSE && txn.category) {
        const category: Category = txn.category;

        if (!categoryMap.has(category.id)) {
          categoryMap.set(category.id, {category, total: 0, count: 0});
        }

        const entry = categoryMap.get(category.id)!;
        entry.total += Math.abs(txn.amount);
        entry.count += 1;
      }
    }

    return Array.from(categoryMap.values())
      .map((item): CategoryReportData => ({
        category: item.category,
        total: item.total,
        count: item.count,
        avgTransaction: item.count > 0 ? item.total / item.count : 0
      }))
      .sort((a: CategoryReportData, b: CategoryReportData): number => b.total - a.total);
  }

  /**
   * Aggregates spending volume and transaction frequency by vendor/merchant.
   *
   * Analyzes where money is being spent most frequently and identifies
   * which categories are associated with specific vendors.
   *
   * @param transactions - The array of transactions to analyze.
   * @returns An array of VendorReportData objects sorted by highest total volume.
   */
  aggregateByVendor(transactions: Transaction[]): VendorReportData[] {
    const vendorMap = new Map<number, {
      merchant: Merchant;
      total: number;
      count: number;
      categories: Set<string>;
    }>();

    for (const txn of transactions) {
      if (txn.type === TransactionType.EXPENSE && txn.merchant) {
        const {merchant} = txn;

        if (!vendorMap.has(merchant.id)) {
          vendorMap.set(merchant.id, {
            merchant,
            total: 0,
            count: 0,
            categories: new Set<string>()
          });
        }

        const entry = vendorMap.get(merchant.id)!;
        entry.total += Math.abs(txn.amount);
        entry.count += 1;

        if (txn.category) {
          entry.categories.add(txn.category.name);
        }
      }
    }

    return Array.from(vendorMap.values())
      .map((item): VendorReportData => ({
        merchant: item.merchant,
        total: item.total,
        count: item.count,
        categories: Array.from(item.categories)
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Generates a monthly breakdown of income vs. expenses.
   *
   * Provides the foundation for trend analysis and savings rate calculation
   * over time. Filters out internal transfers to maintain data integrity.
   *
   * @param transactions - The array of transactions to analyze.
   * @returns Chronologically sorted array of MonthlyReportData.
   */
  aggregateByMonth(transactions: Transaction[]): MonthlyReportData[] {
    const monthMap = new Map<string, { income: number; expense: number }>();

    for (const txn of transactions) {
      if (txn.type === TransactionType.TRANSFER) continue;

      const monthKey: string = this.getYearMonthKey(txn.date);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {income: 0, expense: 0});
      }

      const entry = monthMap.get(monthKey)!;

      if (txn.type === TransactionType.INCOME) {
        entry.income += txn.amount;
      } else if (txn.type === TransactionType.EXPENSE) {
        entry.expense += Math.abs(txn.amount);
      }
    }

    return Array.from(monthMap.entries())
      .map(([month, data]): MonthlyReportData => ({
        month,
        income: data.income,
        expense: data.expense,
        netSavings: data.income - data.expense
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Helper to extract a "YYYY-MM" string from a Date or string source.
   */
  private getYearMonthKey(dateSource: Date | string): string {
    if (dateSource instanceof Date) {
      return `${dateSource.getFullYear()}-${String(dateSource.getMonth() + 1).padStart(2, '0')}`;
    }
    return dateSource.substring(0, 7);
  }
}
