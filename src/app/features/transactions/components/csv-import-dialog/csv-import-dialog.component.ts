import { Component, EventEmitter, inject, input, Output, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FileUpload } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import {
  TransactionPreview,
  SaveTransactionRequest,
  BankName,
  BankOption,
  TransactionFormData,
  TransactionType
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { ToastService } from '@core/services/toast.service';
import {
  formatTransactionAmount,
  getTransactionTypeInfo,
  getAmountClass,
  formatDate
} from '@shared/utils/transaction.utils';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface BatchImportItem {
  id: string;
  file: File;
  accountId: number | null;
  bankName: BankName | null;
  previews: TransactionPreview[];
  status: 'pending' | 'uploading' | 'ready' | 'saving' | 'success' | 'error';
  error?: string;
}

@Component({
  selector: 'app-csv-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    Select,
    FileUpload,
    TableModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './csv-import-dialog.component.html'
})
export class CsvImportDialogComponent {
  visible = input.required<boolean>();
  accounts = input.required<Account[]>();

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() importComplete = new EventEmitter<void>();

  private readonly importService = inject(TransactionImportService);
  private readonly toast = inject(ToastService);

  // State
  currentStep: WritableSignal<number> = signal(0);
  importItems: WritableSignal<BatchImportItem[]> = signal([]);

  // Global controls for bulk applying
  globalAccountId: WritableSignal<number | null> = signal(null);
  globalBankName: WritableSignal<BankName | null> = signal(null);

  uploading: WritableSignal<boolean> = signal(false);
  saving: WritableSignal<boolean> = signal(false);
  
  // Overall status message (e.g., "3 files processed, 1 failed")
  generalMessage: WritableSignal<{ severity: 'success' | 'info' | 'warn' | 'error', text: string } | null> = signal(null);

  // Bank options
  bankOptions: BankOption[] = [
    {
      label: 'Standard CSV',
      value: BankName.STANDARD,
      description: 'Generic format (Date, Description, Amount, Type)'
    },
    {
      label: 'Capital One',
      value: BankName.CAPITAL_ONE,
      description: 'Capital One bank export format'
    },
    {
      label: 'Discover',
      value: BankName.DISCOVER,
      description: 'Discover credit card export format'
    },
    {
      label: 'Synovus',
      value: BankName.SYNOVUS,
      description: 'Synovus bank export format'
    }
  ];

  accountOptions = computed(() => {
    return this.accounts().map(a => ({
      label: a.name,
      value: a.id
    }));
  });

  // Computed properties
  canProceedToPreview = computed(() => {
    const items = this.importItems();
    return items.length > 0 && items.every(item => item.accountId !== null && item.bankName !== null);
  });

  canSave = computed(() => {
    const items = this.importItems();
    // Can save if we have at least one 'ready' item
    return items.some(item => item.status === 'ready' && item.previews.length > 0);
  });

  hasItems = computed(() => this.importItems().length > 0);

  // Combined previews for Step 2
  allPreviews = computed(() => {
    return this.importItems().flatMap(item => 
      item.previews.map(p => ({ ...p, _sourceFile: item.file.name }))
    );
  });

  // Utility functions
  formatTransactionAmount = formatTransactionAmount;
  getTransactionTypeInfo = getTransactionTypeInfo;
  getAmountClass = getAmountClass;
  formatDate = formatDate;

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetDialog();
  }

  onFilesSelect(event: any): void {
    const files = event.files || event.currentFiles;
    if (files && files.length > 0) {
      const newItems: BatchImportItem[] = [];
      for (const file of files) {
        if (!this.importItems().some(i => i.file.name === file.name)) {
          const detectedBank = this.detectBankName(file.name);
          let suggestedAccountId: number | null = null;

          // If we detected a bank, see if we can find a unique account for it
          if (detectedBank) {
             const matchingAccounts = this.accounts().filter(a => a.bankName === detectedBank);
             if (matchingAccounts.length === 1) {
                 suggestedAccountId = matchingAccounts[0].id;
             }
          }

          newItems.push({
            id: crypto.randomUUID(),
            file: file,
            accountId: suggestedAccountId,
            bankName: detectedBank,
            previews: [],
            status: 'pending'
          });
        }
      }
      this.importItems.update(current => [...current, ...newItems]);
      this.generalMessage.set(null);
    }
  }

  onAccountChange(index: number, accountId: number): void {
      this.importItems.update(items => {
          const updated = [...items];
          const item = { ...updated[index] };
          
          item.accountId = accountId;

          // Find the selected account
          const account = this.accounts().find(a => a.id === accountId);
          if (account && account.bankName) {
              item.bankName = account.bankName;
          }
          
          updated[index] = item;
          return updated;
      });
  }
  
  private detectBankName(fileName: string): BankName | null {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('discover')) return BankName.DISCOVER;
    if (lowerName.includes('capital') && lowerName.includes('one')) return BankName.CAPITAL_ONE;
    if (lowerName.includes('synovus')) return BankName.SYNOVUS;
    return null;
  }

  removeItem(index: number): void {
    this.importItems.update(items => items.filter((_, i) => i !== index));
  }

  clearAllFiles(): void {
    this.importItems.set([]);
    this.currentStep.set(0);
  }

  applyGlobalAccount(): void {
    const accountId = this.globalAccountId();
    if (accountId) {
      this.importItems.update(items => items.map(item => ({ ...item, accountId })));
    }
  }

  applyGlobalBank(): void {
    const bankName = this.globalBankName();
    if (bankName) {
      this.importItems.update(items => items.map(item => ({ ...item, bankName })));
    }
  }

  async uploadAndPreview(): Promise<void> {
    if (!this.canProceedToPreview()) return;

    this.uploading.set(true);
    this.generalMessage.set(null);
    
    // Update status to uploading
    this.importItems.update(items => items.map(item => ({ ...item, status: 'uploading', error: undefined })));

    const tasks = this.importItems().map(item => {
      return this.importService.uploadCsv(item.accountId!, item.file, item.bankName!).pipe(
        map(previews => ({ id: item.id, status: 'ready' as const, previews, error: undefined })),
        catchError(err => {
            const errorMsg = err.error?.detail || err.error?.message || 'Failed to parse CSV';
            return of({ id: item.id, status: 'error' as const, previews: [], error: errorMsg });
        })
      );
    });

    forkJoin(tasks).subscribe({
      next: (results) => {
        this.importItems.update(items => 
          items.map(item => {
            const result = results.find(r => r.id === item.id);
            return result ? { ...item, ...result } : item;
          })
        );
        
        const failedCount = results.filter(r => r.status === 'error').length;
        if (failedCount > 0) {
          this.generalMessage.set({ 
            severity: 'warn', 
            text: `${failedCount} file(s) failed to parse. Review errors below.` 
          });
        }
        
        // If at least one file succeeded, move to next step to show previews
        if (results.some(r => r.status === 'ready')) {
            this.currentStep.set(1);
        }
        
        this.uploading.set(false);
      },
      error: (err) => {
        console.error('Unexpected error in forkJoin', err);
        this.uploading.set(false);
      }
    });
  }

  async saveTransactions(): Promise<void> {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.generalMessage.set(null);

    const itemsToSave = this.importItems().filter(item => item.status === 'ready');
    
    // Mark them as saving
    this.importItems.update(all => all.map(item => 
      itemsToSave.find(i => i.id === item.id) ? { ...item, status: 'saving' } : item
    ));

    // Process sequentially to avoid overwhelming the backend or UI (though parallel is possible)
    // Using simple loop with async/await for clarity and sequential execution logic
    let successCount = 0;
    let failCount = 0;

    for (const item of itemsToSave) {
        try {
            const fileHash = await this.importService.calculateFileHash(item.file);
            
            const transactions: TransactionFormData[] = item.previews.map(p => ({
                date: p.date,
                type: p.type,
                accountId: item.accountId!,
                amount: Math.abs(p.amount),
                description: p.description || undefined,
                vendorName: p.vendorName || undefined,
                categoryName: p.suggestedCategory || undefined
            }));

            const request: SaveTransactionRequest = {
                transactions,
                fileName: item.file.name,
                fileHash
            };
            
            // Convert Observable to Promise for sequential execution
            await new Promise<void>((resolve, reject) => {
                this.importService.saveTransactions(item.accountId!, request).subscribe({
                    next: () => {
                        this.importItems.update(all => all.map(i => i.id === item.id ? { ...i, status: 'success' } : i));
                        successCount++;
                        resolve();
                    },
                    error: (err) => {
                        const msg = err.error?.detail || 'Save failed';
                        this.importItems.update(all => all.map(i => i.id === item.id ? { ...i, status: 'error', error: msg } : i));
                        failCount++;
                        resolve(); // Resolve anyway to continue to next file
                    }
                });
            });

        } catch (e) {
            this.importItems.update(all => all.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Pre-save processing failed' } : i));
            failCount++;
        }
    }

    this.saving.set(false);
    
    if (failCount === 0) {
        this.toast.success(`Successfully imported ${successCount} file(s).`);
        this.importComplete.emit();
        this.onHide();
    } else {
        this.generalMessage.set({
            severity: 'error',
            text: `Import completed with errors. ${successCount} succeeded, ${failCount} failed.`
        });
        // Stay on step 1 or 2? Ideally step 0 or stay here to see errors.
        // Actually, successful ones are done. Failed ones are marked error.
        // If we stay on step 1 (preview), user can see which ones failed.
    }
  }

  goBack(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
      this.generalMessage.set(null);
    }
  }

  getCategoryDisplay(categoryName: string | null): string {
    return categoryName || 'Uncategorized';
  }

  getCategorySeverity(categoryName: string | null): 'secondary' | 'contrast' {
    return categoryName ? 'secondary' : 'contrast';
  }

  private resetDialog(): void {
    this.currentStep.set(0);
    this.importItems.set([]);
    this.globalAccountId.set(null);
    this.globalBankName.set(null);
    this.uploading.set(false);
    this.saving.set(false);
    this.generalMessage.set(null);
  }
}
