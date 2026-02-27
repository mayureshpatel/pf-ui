import {Injectable} from '@angular/core';
import {Transaction, TransactionType} from '@models/transaction.model';
import {CategoryReportData, MonthlyReportData, VendorReportData} from '../models/reports.model';
import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

@Injectable({
  providedIn: 'root'
})
export class ReportsDataService {

  /**
   * Aggregate transactions by category
   * Filters out TRANSFER transactions and groups by categoryName
   */
  aggregateByCategory(transactions: Transaction[]): CategoryReportData[] {
    // filter out transfers, keep only INCOME and EXPENSE
    const relevantTransactions: Transaction[] = transactions.filter(
      (transaction: Transaction): boolean => transaction.type !== TransactionType.TRANSFER
    );

    // group by category
    const categoryMap = new Map<Category, { total: number; count: number }>();

    for (const txn of relevantTransactions) {
      const category: Category | undefined = txn.category || undefined;

      if (category) {
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {total: 0, count: 0});
        }

        const entry = categoryMap.get(category)!;
        if (txn.type === TransactionType.EXPENSE) {
          entry.total += Math.abs(txn.amount);
        } else {
          entry.total += txn.amount;
        }

        entry.count += 1;
      }
    }

    // convert map to array and calculate averages
    const results: CategoryReportData[] = [];

    for (const [category, data] of categoryMap.entries()) {
      results.push({
        category: category,
        total: data.total,
        count: data.count,
        avgTransaction: data.total / data.count
      });
    }

    // cort by total (descending)
    results.sort((a: CategoryReportData, b: CategoryReportData): number => b.total - a.total);

    return results;
  }

  /**
   * Aggregate transactions by vendor/merchant
   * Filters out TRANSFER transactions and groups by vendorName
   */
  aggregateByVendor(transactions: Transaction[]): VendorReportData[] {
    // filter out transfers
    const relevantTransactions: Transaction[] = transactions.filter(
      (t: Transaction): boolean => t.type !== TransactionType.TRANSFER
    );

    // group by vendor
    const vendorMap = new Map<Merchant, {
      total: number;
      count: number;
      categories: Set<Category>
    }>();

    for (const txn of relevantTransactions) {
      const merchant: Merchant | undefined = txn.merchant || undefined;

      if (!vendorMap.has(merchant)) {
        vendorMap.set(merchant, {
          total: 0,
          count: 0,
          categories: new Set<Category>()
        });
      }

      const entry = vendorMap.get(merchant)!;

      // sum absolute amounts
      entry.total += Math.abs(txn.amount);
      entry.count += 1;

      // track unique categories
      if (txn.category) {
        entry.categories.add(txn.category);
      }
    }

    // convert map to array
    const results: VendorReportData[] = [];

    for (const [merchant, data] of vendorMap.entries()) {
      results.push({
        merchant: merchant,
        total: data.total,
        count: data.count,
        categories: Array.from(data.categories)
      });
    }

    // sort by total (descending)
    results.sort((a: VendorReportData, b: VendorReportData): number => b.total - a.total);

    return results;
  }

  /**
   * Aggregate transactions by month
   * Separates INCOME from EXPENSE and calculates net savings
   */
  aggregateByMonth(transactions: Transaction[]): MonthlyReportData[] {
    // Filter out transfers
    const relevantTransactions: Transaction[] = transactions.filter(
      (t: Transaction): boolean => t.type !== TransactionType.TRANSFER
    );

    // Group by month (YYYY-MM format)
    const monthMap = new Map<string, { income: number; expense: number }>();

    for (const txn of relevantTransactions) {
      // Extract YYYY-MM from ISO date string
      const month: string = txn.date.substring(0, 7); // "2024-01-15" -> "2024-01"

      if (!monthMap.has(month)) {
        monthMap.set(month, {income: 0, expense: 0});
      }

      const entry = monthMap.get(month)!;

      if (txn.type === TransactionType.INCOME) {
        entry.income += txn.amount;
      } else if (txn.type === TransactionType.EXPENSE) {
        // Expenses are typically negative in the database, take absolute value
        entry.expense += Math.abs(txn.amount);
      }
    }

    // Convert map to array and calculate net savings
    const results: MonthlyReportData[] = [];

    for (const [month, data] of monthMap.entries()) {
      results.push({
        month,
        income: data.income,
        expense: data.expense,
        netSavings: data.income - data.expense
      });
    }

    // Sort chronologically
    results.sort((a: MonthlyReportData, b: MonthlyReportData): number => a.month.localeCompare(b.month));

    return results;
  }
}
