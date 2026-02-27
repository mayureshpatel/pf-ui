import {
  Component,
  computed,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {Select} from 'primeng/select';
import {FileUpload} from 'primeng/fileupload';
import {TableModule} from 'primeng/table';
import {MessageModule} from 'primeng/message';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {TagModule} from 'primeng/tag';
import {TooltipModule} from 'primeng/tooltip';
import {BankOption, SaveTransactionRequest, TransactionFormData, TransactionPreview} from '@models/transaction.model';
import {Account, BankName} from '@models/account.model';
import {TransactionImportService} from '@features/transactions/services/transaction-import.service';
import {ToastService} from '@core/services/toast.service';
import {
  formatDate,
  formatTransactionAmount,
  getAmountClass,
  getTransactionTypeInfo
} from '@shared/utils/transaction.utils';
import {forkJoin, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';

interface BatchImportItem {
  id: string;
  file: File;
  accountId: number;
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
  // injected services
  private readonly importService: TransactionImportService = inject(TransactionImportService);
  private readonly toast: ToastService = inject(ToastService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  accounts: InputSignal<Account[]> = input.required<Account[]>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  importComplete: OutputEmitterRef<void> = output<void>();

  // State
  currentStep: WritableSignal<number> = signal(0);
  importItems: WritableSignal<BatchImportItem[]> = signal([]);

  // Global controls for bulk applying
  globalAccountId: WritableSignal<number | null> = signal(null);
  globalBankName: WritableSignal<BankName | null> = signal(null);

  uploading: WritableSignal<boolean> = signal(false);
  saving: WritableSignal<boolean> = signal(false);

  // Overall status message (e.g., "3 files processed, 1 failed")
  generalMessage: WritableSignal<{
    severity: 'success' | 'info' | 'warn' | 'error',
    text: string
  } | null> = signal(null);

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
    },
    {
      label: 'Universal CSV',
      value: BankName.UNIVERSAL,
      description: 'Auto-detect columns (Date, Amount, Description)'
    }
  ];

  // computed properties
  accountOptions = computed(() => {
    return this.accounts().map((a: Account) => ({
      label: a.name,
      value: a.id
    }));
  });

  canProceedToPreview: Signal<boolean> = computed((): boolean => {
    const items: BatchImportItem[] = this.importItems();
    return items.length > 0 && items.every((item: BatchImportItem): boolean => item.accountId !== null && item.bankName !== null);
  });

  canSave: Signal<boolean> = computed((): boolean => {
    const items: BatchImportItem[] = this.importItems();
    // Can save if we have at least one 'ready' item
    return items.some((item: BatchImportItem): boolean => item.status === 'ready' && item.previews.length > 0);
  });

  hasItems: Signal<boolean> = computed((): boolean => this.importItems().length > 0);

  // Combined previews for Step 2
  allPreviews = computed(() => {
    return this.importItems().flatMap((item: BatchImportItem) =>
      item.previews.map((p: TransactionPreview) => ({...p, _sourceFile: item.file.name}))
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
        if (!this.importItems().some((i: BatchImportItem): boolean => i.file.name === file.name)) {
          const detectedBank: BankName | null = this.detectBankName(file.name);
          let suggestedAccountId: number = -1;

          // If we detected a bank, see if we can find a unique account for it
          if (detectedBank) {
            const matchingAccounts: Account[] = this.accounts().filter((a: Account): boolean => a.bank === detectedBank);
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
      this.importItems.update((current: BatchImportItem[]): BatchImportItem[] => [...current, ...newItems]);
      this.generalMessage.set(null);
    }
  }

  onAccountChange(index: number, accountId: number): void {
    this.importItems.update((items: BatchImportItem[]): BatchImportItem[] => {
      const updated: BatchImportItem[] = [...items];
      const item = {...updated[index]};

      item.accountId = accountId;

      // Find the selected account
      const account: Account | undefined = this.accounts().find((a: Account): boolean => a.id === accountId);
      if (account?.bank) {
        item.bankName = account.bank;
      }

      updated[index] = item;
      return updated;
    });
  }

  private detectBankName(fileName: string): BankName | null {
    const lowerName: string = fileName.toLowerCase();

    if (lowerName.includes('discover')) return BankName.DISCOVER;
    if (lowerName.includes('capital') && lowerName.includes('one')) return BankName.CAPITAL_ONE;
    if (lowerName.includes('synovus')) return BankName.SYNOVUS;
    return null;
  }

  removeItem(index: number): void {
    this.importItems.update((items: BatchImportItem[]): BatchImportItem[] => items.filter((_: BatchImportItem, i: number): boolean => i !== index));
  }

  clearAllFiles(): void {
    this.importItems.set([]);
    this.currentStep.set(0);
  }

  applyGlobalAccount(): void {
    const accountId: number | null = this.globalAccountId();

    if (accountId) {
      this.importItems.update((items: BatchImportItem[]) => items.map((item: BatchImportItem) => ({
        ...item,
        accountId
      })));
    }
  }

  applyGlobalBank(): void {
    const bankName: BankName | null = this.globalBankName();

    if (bankName) {
      this.importItems.update((items: BatchImportItem[]) => items.map((item: BatchImportItem) => ({
        ...item,
        bankName
      })));
    }
  }

  async uploadAndPreview(): Promise<void> {
    if (!this.canProceedToPreview()) return;

    this.uploading.set(true);
    this.generalMessage.set(null);

    // Update status to uploading
    this.importItems.update((items: BatchImportItem[]) => items.map((item: BatchImportItem) => ({
      ...item,
      status: 'uploading',
      error: undefined
    })));

    const tasks = this.importItems().map((item: BatchImportItem) => {
      return this.importService.uploadCsv(item.accountId!, item.file, item.bankName!).pipe(
        map((previews: TransactionPreview[]) => ({id: item.id, status: 'ready' as const, previews, error: undefined})),
        catchError((err: any) => {
          const errorMsg: any = err.error?.detail || err.error?.message || 'Failed to parse CSV';
          return of({id: item.id, status: 'error' as const, previews: [], error: errorMsg});
        })
      );
    });

    forkJoin(tasks).subscribe({
      next: (results) => {
        this.importItems.update((items: BatchImportItem[]) =>
          items.map((item: BatchImportItem) => {
            const result = results.find(r => r.id === item.id);
            return result ? {...item, ...result} : item;
          })
        );

        const failedCount: number = results.filter(r => r.status === 'error').length;
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
      error: (err: any): void => {
        console.error('Unexpected error during upload and preview:', err);
        this.uploading.set(false);
      }
    });
  }

  async saveTransactions(): Promise<void> {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.generalMessage.set(null);

    const itemsToSave: BatchImportItem[] = this.importItems().filter((item: BatchImportItem): boolean => item.status === 'ready');

    // Mark them as saving
    this.importItems.update((all: BatchImportItem[]): BatchImportItem[] => all.map((item: BatchImportItem): BatchImportItem =>
      itemsToSave.some((i: BatchImportItem): boolean => i.id === item.id) ? {...item, status: 'saving'} : item
    ));

    let successCount: number = 0;
    let failCount: number = 0;

    for (const item of itemsToSave) {
      try {
        const fileHash: string = await this.importService.calculateFileHash(item.file);

        const transactions: TransactionFormData[] = item.previews.map((p: TransactionPreview) => ({
          date: p.date,
          postDate: p.postDate,
          type: p.type,
          accountId: item.accountId,
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
        await new Promise<void>((resolve, reject): void => {
          this.importService.saveTransactions(item.accountId, request).subscribe({
            next: () => {
              this.importItems.update((all: BatchImportItem[]): BatchImportItem[] => all.map((i: BatchImportItem): BatchImportItem => i.id === item.id ? {
                ...i,
                status: 'success'
              } : i));
              successCount++;
              resolve();
            },
            error: (err: any): void => {
              const msg: any = err.error?.detail || 'Save failed';
              this.importItems.update((all: BatchImportItem[]) => all.map((i: BatchImportItem) => i.id === item.id ? {
                ...i,
                status: 'error',
                error: msg
              } : i));
              failCount++;
              resolve(); // Resolve anyway to continue to next file
            }
          });
        });

      } catch (e) {
        this.importItems.update((all: BatchImportItem[]): BatchImportItem[] => all.map((i: BatchImportItem): BatchImportItem => i.id === item.id ? {
          ...i,
          status: 'error',
          error: 'Pre-save processing failed'
        } : i));
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
