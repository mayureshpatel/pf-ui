import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { VendorRule, VendorRuleFormData } from '@models/vendor-rule.model';
import { Transaction, TransactionFormData } from '@models/transaction.model';
import { VendorRuleApiService } from '../services/vendor-rule-api.service';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { VendorRuleFormDialogComponent } from './components/vendor-rule-form-dialog/vendor-rule-form-dialog.component';
import { ApplyRulesDialogComponent, AffectedTransaction } from './components/apply-rules-dialog/apply-rules-dialog.component';
import { cleanVendorName } from '@shared/utils/vendor-cleaner.util';

@Component({
  selector: 'app-vendor-rules',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    ConfirmDialogModule,
    TooltipModule,
    VendorRuleFormDialogComponent,
    ApplyRulesDialogComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './vendor-rules.component.html'
})
export class VendorRulesComponent implements OnInit {
  private readonly vendorRuleApi = inject(VendorRuleApiService);
  private readonly transactionApi = inject(TransactionApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);

  // State
  rules: WritableSignal<VendorRule[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  savingRule: WritableSignal<boolean> = signal(false);
  showApplyDialog: WritableSignal<boolean> = signal(false);
  affectedTransactions: WritableSignal<AffectedTransaction[]> = signal([]);
  totalAffected: WritableSignal<number> = signal(0);
  applyingRules: WritableSignal<boolean> = signal(false);

  // Store pending updates for apply confirmation
  private pendingUpdates: TransactionFormData[] = [];

  ngOnInit(): void {
    this.loadRules();
  }

  loadRules(): void {
    this.loading.set(true);
    this.vendorRuleApi.getVendorRules().subscribe({
      next: (rules) => {
        // Sort by priority DESC, then keyword length DESC
        const sorted = [...rules].sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return b.keyword.length - a.keyword.length;
        });
        this.rules.set(sorted);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load vendor rules');
        this.loading.set(false);
      }
    });
  }

  openCreateDialog(): void {
    this.showDialog.set(true);
  }

  onSave(formData: VendorRuleFormData): void {
    this.savingRule.set(true);
    this.vendorRuleApi.createVendorRule(formData).subscribe({
      next: () => {
        this.toast.success('Vendor rule created successfully');
        this.showDialog.set(false);
        this.savingRule.set(false);
        this.loadRules();
      },
      error: (error) => {
        this.toast.error(error.error?.detail || 'Failed to create vendor rule');
        this.savingRule.set(false);
      }
    });
  }

  deleteRule(rule: VendorRule): void {
    this.confirmationService.confirm({
      header: 'Delete Vendor Rule?',
      message: `This will delete the rule "${rule.keyword}" → "${rule.vendorName}". This action cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.vendorRuleApi.deleteVendorRule(rule.id).subscribe({
          next: () => {
            this.toast.success('Vendor rule deleted successfully');
            this.loadRules();
          },
          error: (error) => {
            const message = error.error?.detail || 'Failed to delete vendor rule';
            this.toast.error(message);
          }
        });
      }
    });
  }

  async applyRulesToAll(): Promise<void> {
    this.loading.set(true);

    try {
      // 1. Fetch all transactions (handle pagination)
      const PAGE_SIZE = 1000;
      let allTransactions: Transaction[] = [];
      let page = 0;

      while (true) {
        const response = await firstValueFrom(
          this.transactionApi.getTransactions({}, { page, size: PAGE_SIZE, sort: 'date,desc' })
        );
        allTransactions.push(...response.content);
        if (response.last) break;
        page++;
      }

      // 2. Get current vendor rules
      const rules = this.rules();

      // 3. Apply rules and collect changes
      const updates: TransactionFormData[] = [];
      const affected: AffectedTransaction[] = [];

      for (const txn of allTransactions) {
        const newVendor = cleanVendorName(txn.description, rules);
        if (newVendor && newVendor !== txn.vendorName) {
          updates.push({
            id: txn.id,
            date: txn.date,
            type: txn.type,
            accountId: txn.accountId,
            amount: txn.amount,
            description: txn.description || '',
            vendorName: newVendor,
            categoryName: txn.categoryName || undefined
          });

          affected.push({
            id: txn.id,
            description: txn.description || '',
            oldVendor: txn.vendorName,
            newVendor: newVendor
          });
        }
      }

      // 4. Show preview or message
      if (updates.length === 0) {
        this.toast.info('No transactions match current vendor rules');
        this.loading.set(false);
        return;
      }

      this.pendingUpdates = updates;
      this.affectedTransactions.set(affected);
      this.totalAffected.set(updates.length);
      this.showApplyDialog.set(true);
      this.loading.set(false);
    } catch (error) {
      this.toast.error('Failed to analyze transactions');
      this.loading.set(false);
    }
  }

  onApplyConfirm(): void {
    this.applyingRules.set(true);

    this.transactionApi.bulkUpdateTransactions(this.pendingUpdates).subscribe({
      next: (updated) => {
        this.toast.success(`${updated.length} transaction${updated.length > 1 ? 's' : ''} updated with vendor names`);
        this.showApplyDialog.set(false);
        this.applyingRules.set(false);
        this.pendingUpdates = [];
        this.affectedTransactions.set([]);
        this.totalAffected.set(0);
      },
      error: (error) => {
        this.toast.error(error.error?.detail || 'Failed to apply vendor rules');
        this.applyingRules.set(false);
      }
    });
  }
}
