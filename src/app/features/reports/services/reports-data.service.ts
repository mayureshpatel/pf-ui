import { Injectable } from '@angular/core';
import { Transaction, TransactionType } from '@models/transaction.model';
import {
  CategoryReportData,
  VendorReportData,
  MonthlyReportData
} from '../models/reports.model';

@Injectable({
  providedIn: 'root'
})
export class ReportsDataService {

  /**
   * Aggregate transactions by category
   * Filters out TRANSFER transactions and groups by categoryName
   */
  aggregateByCategory(transactions: Transaction[]): CategoryReportData[] {
    // Filter out transfers, keep only INCOME and EXPENSE
    const relevantTransactions = transactions.filter(
      t => t.type !== TransactionType.TRANSFER
    );

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number }>();

    for (const txn of relevantTransactions) {
      const categoryName = txn.categoryName || 'Uncategorized';

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { total: 0, count: 0 });
      }

      const entry = categoryMap.get(categoryName)!;

      // For expenses, amount should be negative; for income, positive
      // We want to sum the absolute values for spending analysis
      if (txn.type === TransactionType.EXPENSE) {
        entry.total += Math.abs(txn.amount);
      } else {
        entry.total += txn.amount;
      }

      entry.count += 1;
    }

    // Convert map to array and calculate averages
    const results: CategoryReportData[] = [];

    for (const [categoryName, data] of categoryMap.entries()) {
      results.push({
        categoryName,
        total: data.total,
        count: data.count,
        avgTransaction: data.total / data.count
      });
    }

    // Sort by total (descending)
    results.sort((a, b) => b.total - a.total);

    return results;
  }

  /**
   * Aggregate transactions by vendor/merchant
   * Filters out TRANSFER transactions and groups by vendorName
   */
  aggregateByVendor(transactions: Transaction[]): VendorReportData[] {
    // Filter out transfers
    const relevantTransactions = transactions.filter(
      t => t.type !== TransactionType.TRANSFER
    );

    // Group by vendor
    const vendorMap = new Map<string, {
      total: number;
      count: number;
      categories: Set<string>
    }>();

    for (const txn of relevantTransactions) {
      const vendorName = txn.vendorName || 'Unknown Vendor';

      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          total: 0,
          count: 0,
          categories: new Set<string>()
        });
      }

      const entry = vendorMap.get(vendorName)!;

      // Sum absolute amounts
      entry.total += Math.abs(txn.amount);
      entry.count += 1;

      // Track unique categories
      if (txn.categoryName) {
        entry.categories.add(txn.categoryName);
      }
    }

    // Convert map to array
    const results: VendorReportData[] = [];

    for (const [vendorName, data] of vendorMap.entries()) {
      results.push({
        vendorName,
        total: data.total,
        count: data.count,
        categories: Array.from(data.categories)
      });
    }

    // Sort by total (descending)
    results.sort((a, b) => b.total - a.total);

    return results;
  }

  /**
   * Aggregate transactions by month
   * Separates INCOME from EXPENSE and calculates net savings
   */
  aggregateByMonth(transactions: Transaction[]): MonthlyReportData[] {
    // Filter out transfers
    const relevantTransactions = transactions.filter(
      t => t.type !== TransactionType.TRANSFER
    );

    // Group by month (YYYY-MM format)
    const monthMap = new Map<string, { income: number; expense: number }>();

    for (const txn of relevantTransactions) {
      // Extract YYYY-MM from ISO date string
      const month = txn.date.substring(0, 7); // "2024-01-15" -> "2024-01"

      if (!monthMap.has(month)) {
        monthMap.set(month, { income: 0, expense: 0 });
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
    results.sort((a, b) => a.month.localeCompare(b.month));

    return results;
  }
}
