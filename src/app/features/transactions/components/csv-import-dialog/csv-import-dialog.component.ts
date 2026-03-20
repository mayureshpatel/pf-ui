import {
  Component,
  computed,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {forkJoin, from, of} from 'rxjs';
import {catchError, concatMap, finalize, map, toArray} from 'rxjs/operators';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {Select} from 'primeng/select';
import {FileUpload} from 'primeng/fileupload';
import {TableModule} from 'primeng/table';
import {MessageModule} from 'primeng/message';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {TagModule} from 'primeng/tag';
import {TooltipModule} from 'primeng/tooltip';

import {BankOption, SaveTransactionRequest, TransactionPreview, TransactionType} from '@models/transaction.model';
import {Account, BankName} from '@models/account.model';
import {TransactionImportService} from '@features/transactions/services/transaction-import.service';
import {ToastService} from '@core/services/toast.service';

/**
 * Represents a single file in a multi-file import batch.
 */
interface BatchImportItem {
  id: string;
  file: File;
  accountId: number;
  bankName: BankName | null;
  previews: TransactionPreview[];
  status: 'pending' | 'uploading' | 'ready' | 'saving' | 'success' | 'error';
  error?: string;
}

/**
 * Sophisticated dialog for processing and mapping CSV transaction exports.
 *
 * Supports multi-file batches, automatic bank format detection,
 * and a comprehensive preview ledger before final persistence.
 */
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
  private readonly importService: TransactionImportService = inject(TransactionImportService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** Available bank accounts for mapping. */
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();

  /** Emitted when the entire batch is successfully imported. */
  readonly importComplete: OutputEmitterRef<void> = output<void>();

  /** Current workflow step (0: Setup, 1: Preview). */
  readonly currentStep: WritableSignal<number> = signal(0);

  /** Active batch of files being processed. */
  readonly importItems: WritableSignal<BatchImportItem[]> = signal([]);

  /** Global overrides for the current batch. */
  readonly globalAccountId: WritableSignal<number | null> = signal(null);
  readonly globalBankName: WritableSignal<BankName | null> = signal(null);

  readonly uploading: WritableSignal<boolean> = signal(false);
  readonly saving: WritableSignal<boolean> = signal(false);

  /** System-wide feedback message for the import process. */
  readonly generalMessage: WritableSignal<{
    severity: 'success' | 'info' | 'warn' | 'error',
    text: string
  } | null> = signal(null);

  readonly bankOptions: BankOption[] = [
    {label: 'Standard CSV', value: BankName.STANDARD, description: 'Generic format (Date, Description, Amount)'},
    {label: 'Capital One', value: BankName.CAPITAL_ONE, description: 'Official bank export format'},
    {label: 'Discover', value: BankName.DISCOVER, description: 'Official card export format'},
    {label: 'Synovus', value: BankName.SYNOVUS, description: 'Official bank export format'},
    {label: 'Universal CSV', value: BankName.UNIVERSAL, description: 'Intelligent auto-detection'}
  ];

  readonly accountOptions = computed(() =>
    this.accounts().map((a: Account) => ({label: a.name, value: a.id}))
  );

  readonly canProceedToPreview: Signal<boolean> = computed((): boolean => {
    const items: BatchImportItem[] = this.importItems();
    return items.length > 0 && items.every((i: BatchImportItem): boolean => i.accountId !== -1 && i.bankName !== null);
  });

  readonly canSave: Signal<boolean> = computed((): boolean =>
    this.importItems().some((i: BatchImportItem): boolean => i.status === 'ready' && i.previews.length > 0)
  );

  readonly hasItems: Signal<boolean> = computed((): boolean => this.importItems().length > 0);

  /** Flattens all file previews into a single master ledger for review. */
  readonly allPreviews = computed(() =>
    this.importItems().flatMap((item: BatchImportItem) =>
      item.previews.map((p: TransactionPreview) => ({...p, _sourceFile: item.file.name}))
    )
  );

  /**
   * Resets and closes the dialog.
   */
  onHide(): void {
    this.visible.set(false);
    this.resetDialog();
  }

  /**
   * Processes file selection and attempts automatic metadata detection.
   */
  onFilesSelect(event: any): void {
    const files = event.files || event.currentFiles;
    if (!files?.length) return;

    const newItems: BatchImportItem[] = [];
    for (const file of files) {
      if (!this.importItems().some((i: BatchImportItem): boolean => i.file.name === file.name)) {
        const detectedBank: BankName | null = this.detectBankName(file.name);
        let suggestedAccountId: number = -1;

        if (detectedBank) {
          const match: Account | undefined = this.accounts().find((a: Account): boolean => a.bank === detectedBank);
          if (match) suggestedAccountId = match.id;
        }

        newItems.push({
          id: crypto.randomUUID(),
          file,
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

  /**
   * Synchronizes per-file account selection.
   */
  onAccountChange(index: number, accountId: number): void {
    this.importItems.update((items: BatchImportItem[]): BatchImportItem[] => {
      const updated: BatchImportItem[] = [...items];
      const account: Account | undefined = this.accounts().find((a: Account): boolean => a.id === accountId);
      updated[index] = {
        ...updated[index],
        accountId,
        bankName: account?.bank || updated[index].bankName
      };
      return updated;
    });
  }

  /**
   * Removes a file from the current batch.
   */
  removeItem(index: number): void {
    this.importItems.update((items: BatchImportItem[]): BatchImportItem[] => items.filter((_: BatchImportItem, i: number): boolean => i !== index));
  }

  /**
   * Heuristic engine for bank format detection based on filenames.
   */
  private detectBankName(fileName: string): BankName | null {
    const name: string = fileName.toLowerCase();
    if (name.includes('discover')) return BankName.DISCOVER;
    if (name.includes('capital')) return BankName.CAPITAL_ONE;
    if (name.includes('synovus')) return BankName.SYNOVUS;
    return null;
  }

  applyGlobalAccount(): void {
    const id: number | null = this.globalAccountId();
    if (id) this.importItems.update((items: BatchImportItem[]) => items.map((i: BatchImportItem) => ({
      ...i,
      accountId: id
    })));
  }

  applyGlobalBank(): void {
    const bank: BankName | null = this.globalBankName();
    if (bank) this.importItems.update((items: BatchImportItem[]) => items.map((i: BatchImportItem) => ({
      ...i,
      bankName: bank
    })));
  }

  /**
   * Uploads all files in parallel and retrieves transaction previews.
   */
  uploadAndPreview(): void {
    if (!this.canProceedToPreview()) return;

    this.uploading.set(true);
    this.importItems.update((items: BatchImportItem[]) => items.map((i: BatchImportItem) => ({
      ...i,
      status: 'uploading',
      error: undefined
    })));

    const tasks = this.importItems().map((item: BatchImportItem) =>
      this.importService.uploadCsv(item.accountId, item.file, item.bankName!).pipe(
        map((previews: TransactionPreview[]) => ({id: item.id, status: 'ready' as const, previews})),
        catchError((err: any) => of({
          id: item.id,
          status: 'error' as const,
          previews: [],
          error: err.error?.detail || 'Format Mismatch'
        }))
      )
    );

    forkJoin(tasks).pipe(
      finalize((): void => this.uploading.set(false))
    ).subscribe({
      next: (results): void => {
        console.log('Upload results:', results);
        this.importItems.update((items: BatchImportItem[]) =>
          items.map((i: BatchImportItem) => ({...i, ...results.find(r => r.id === i.id)}))
        );

        if (results.some(r => r.status === 'ready')) {
          this.currentStep.set(1);
        } else {
          this.generalMessage.set({severity: 'error', text: 'All files failed to parse. Verify bank formats.'});
        }
      }
    });
  }

  /**
   * Finalizes the import by calculating hashes and persisting data to the ledger.
   */
  saveTransactions(): void {
    if (!this.canSave()) return;

    this.saving.set(true);
    const itemsToSave: BatchImportItem[] = this.importItems().filter((i: BatchImportItem): boolean => i.status === 'ready');

    from(itemsToSave).pipe(
      concatMap((item: BatchImportItem) => from(this.importService.calculateFileHash(item.file)).pipe(
        map((fileHash: string) => {
          item.status = 'saving';
          const transactions: any[] = item.previews.map((p: TransactionPreview) => ({
            date: p.date,
            postDate: p.postDate,
            type: p.type,
            amount: Math.abs(p.amount),
            description: p.description,
            merchant: p.suggestedMerchant,
            category: p.suggestedCategory
          }));

          return {
            transactions: transactions as any,
            fileName: item.file.name,
            fileHash,
            accountId: item.accountId
          } as SaveTransactionRequest;
        })
      )),
      toArray(),
      concatMap((requests: SaveTransactionRequest[]) => {
        if (requests.length === 0) return of(true);
        return this.importService.saveBulkTransactions(requests).pipe(
          map(() => true),
          catchError(() => of(false))
        );
      }),
      finalize((): void => this.saving.set(false))
    ).subscribe((success) => {
      if (success) {
        this.importItems.update(items => items.map(item => ({...item, status: 'success'})));
        this.toast.success(`Batch complete: ${itemsToSave.length} files imported.`);
        this.importComplete.emit();
        this.onHide();
      } else {
        this.importItems.update(items => items.map(item => ({...item, status: 'error'})));
        this.generalMessage.set({
          severity: 'warn',
          text: `Import failed to process the transaction batch. Please review and try again.`
        });
      }
    });
  }

  /**
   * Returns to the previous step
   */
  goBack(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
      this.generalMessage.set(null);
    }
  }

  private resetDialog(): void {
    this.currentStep.set(0);
    this.importItems.set([]);
    this.uploading.set(false);
    this.saving.set(false);
    this.generalMessage.set(null);
  }

  getTransactionTypeStyles(type: TransactionType): string {
    switch (type) {
      case TransactionType.INCOME:
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20';
      case TransactionType.EXPENSE:
        return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20';
      default:
        return 'text-surface-500 bg-surface-100';
    }
  }
}
