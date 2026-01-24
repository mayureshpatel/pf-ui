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
    TagModule
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
  selectedAccountId: WritableSignal<number | null> = signal(null);
  selectedBankName: WritableSignal<BankName | null> = signal(null);
  selectedFile: WritableSignal<File | null> = signal(null);
  previews: WritableSignal<TransactionPreview[]> = signal([]);
  uploading: WritableSignal<boolean> = signal(false);
  saving: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

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

  canProceedToPreview = computed(() =>
    this.selectedAccountId() !== null &&
    this.selectedBankName() !== null &&
    this.selectedFile() !== null
  );

  canSave = computed(() => this.previews().length > 0);

  // Utility functions
  formatTransactionAmount = formatTransactionAmount;
  getTransactionTypeInfo = getTransactionTypeInfo;
  getAmountClass = getAmountClass;
  formatDate = formatDate;

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetDialog();
  }

  onFileSelect(event: any): void {
    const files = event.files || event.currentFiles;
    if (files && files.length > 0) {
      this.selectedFile.set(files[0]);
      this.errorMessage.set(null);
    }
  }

  onFileClear(): void {
    this.selectedFile.set(null);
  }

  async uploadAndPreview(): Promise<void> {
    if (!this.canProceedToPreview()) {
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set(null);

    const accountId = this.selectedAccountId()!;
    const bankName = this.selectedBankName()!;
    const file = this.selectedFile()!;

    this.importService.uploadCsv(accountId, file, bankName).subscribe({
      next: (previews) => {
        this.previews.set(previews);
        this.uploading.set(false);
        this.currentStep.set(1);
      },
      error: (error) => {
        this.errorMessage.set(
          error.error?.detail || error.error?.message || 'Failed to parse CSV file. Please check the format and try again.'
        );
        this.uploading.set(false);
      }
    });
  }

  async saveTransactions(): Promise<void> {
    if (!this.canSave()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const accountId = this.selectedAccountId()!;
    const file = this.selectedFile()!;
    const previews = this.previews();

    try {
      const fileHash = await this.importService.calculateFileHash(file);

      // Convert previews to TransactionFormData
      const transactions: TransactionFormData[] = previews.map(p => ({
        date: p.date,
        type: p.type,
        accountId: accountId,
        amount: Math.abs(p.amount),
        description: p.description || undefined,
        vendorName: p.vendorName || undefined,
        categoryName: p.suggestedCategory || undefined
      }));

      const request: SaveTransactionRequest = {
        transactions,
        fileName: file.name,
        fileHash
      };

      this.importService.saveTransactions(accountId, request).subscribe({
        next: (message) => {
          this.toast.success(message);
          this.importComplete.emit();
          this.onHide();
        },
        error: (error) => {
          this.errorMessage.set(
            error.error?.detail || 'Failed to save transactions. Please try again.'
          );
          this.saving.set(false);
        }
      });
    } catch (error) {
      this.errorMessage.set('Failed to process file. Please try again.');
      this.saving.set(false);
    }
  }

  goBack(): void {
    if (this.currentStep() > 0) {
      this.currentStep.set(this.currentStep() - 1);
      this.errorMessage.set(null);
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
    this.selectedAccountId.set(null);
    this.selectedBankName.set(null);
    this.selectedFile.set(null);
    this.previews.set([]);
    this.uploading.set(false);
    this.saving.set(false);
    this.errorMessage.set(null);
  }
}
