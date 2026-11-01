import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FileSelectEvent, FileUpload } from 'primeng/fileupload';
import { SelectModule } from 'primeng/select';
import { Account, BankName } from '@models/account.model';
import { bankLabel } from '@features/accounts/utils/account-totals';
import { BatchFile, BatchSummary, CsvImportBatchStore } from './csv-import-batch.store';
import { FileMatchReason } from './csv-import-file-matcher';

interface SelectOption<T> {
  label: string;
  value: T;
}

const NEEDS_ACCOUNT_REASONS: Record<FileMatchReason, string> = {
  matched: 'choose an account for this file',
  'multiple-accounts': 'more than one account uses this bank',
  'no-account': 'no account for this bank',
  'unrecognised-name': 'name not recognised, expected bank-YYYY-MM.csv',
};

/**
 * Step 1 of the CSV import dialog: the chosen files with a per-file account and bank, an "Apply
 * to selected" row, and the file picker. It reads and writes the {@link CsvImportBatchStore}
 * provided by the dialog; which rows are ticked is local to this component.
 */
@Component({
  selector: 'app-csv-import-files-step',
  standalone: true,
  imports: [FormsModule, ButtonModule, CheckboxModule, FileUpload, SelectModule],
  templateUrl: './csv-import-files-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvImportFilesStepComponent {
  private readonly store: CsvImportBatchStore = inject(CsvImportBatchStore);

  readonly items = this.store.items;
  readonly busy = computed((): boolean => this.store.previewing() || this.store.committing());

  readonly accountOptions = computed((): SelectOption<number>[] =>
    this.store.accountList().map((a: Account): SelectOption<number> => ({
      label: a.name,
      value: a.id,
    })),
  );
  readonly bankOptions: SelectOption<BankName>[] = Object.values(BankName).map(
    (bank: BankName): SelectOption<BankName> => ({ label: bankLabel(bank), value: bank }),
  );

  private readonly ticked = signal<ReadonlySet<string>>(new Set());
  /** Ticked rows that are still in the batch. */
  readonly selectedIds = computed((): string[] =>
    this.items()
      .map((i: BatchFile): string => i.id)
      .filter((id: string): boolean => this.ticked().has(id)),
  );
  readonly allSelected = computed(
    (): boolean => this.items().length > 0 && this.selectedIds().length === this.items().length,
  );
  readonly someSelected = computed(
    (): boolean => this.selectedIds().length > 0 && !this.allSelected(),
  );

  /** Values for the "Apply to selected" row; null leaves that field unchanged. */
  readonly bulkAccountId = signal<number | null>(null);
  readonly bulkBank = signal<BankName | null>(null);

  readonly summaryText = computed((): string => {
    const s: BatchSummary = this.store.summary();
    if (s.fileCount === 0) return '';
    const parts: string[] = [`${s.fileCount} ${s.fileCount === 1 ? 'file' : 'files'}`];
    if (s.firstMonth) {
      parts.push(s.firstMonth === s.lastMonth ? s.firstMonth : `${s.firstMonth} to ${s.lastMonth}`);
    }
    if (s.needsAccountCount > 0) {
      parts.push(
        `${s.needsAccountCount} ${s.needsAccountCount === 1 ? 'needs' : 'need'} an account`,
      );
    }
    return parts.join(', ');
  });
  readonly missingText = computed((): string => {
    const missing: string[] = this.store.summary().missingMonths;
    return missing.length ? `missing ${missing.join(', ')}` : '';
  });

  isSelected(id: string): boolean {
    return this.ticked().has(id);
  }

  toggle(id: string, on: boolean): void {
    this.ticked.update((current: ReadonlySet<string>): ReadonlySet<string> => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  toggleAll(on: boolean): void {
    this.ticked.set(on ? new Set(this.items().map((i: BatchFile): string => i.id)) : new Set());
  }

  apply(): void {
    this.store.applyToSelected(this.selectedIds(), this.bulkAccountId(), this.bulkBank());
  }

  onFilesSelect(event: FileSelectEvent): void {
    if (event.files?.length) this.store.addFiles(event.files);
  }

  setAccount(id: string, accountId: number | null): void {
    this.store.setAccount(id, accountId);
  }

  setBank(id: string, bank: BankName | null): void {
    this.store.setBank(id, bank);
  }

  remove(id: string): void {
    this.toggle(id, false);
    this.store.removeFile(id);
  }

  isUnsupported(item: BatchFile): boolean {
    return /\.xlsx?$/i.test(item.file.name);
  }

  /** A spreadsheet is never uploaded, so it needs no account; it fails at Preview with the reason. */
  needsAccount(item: BatchFile): boolean {
    return !this.isUnsupported(item) && item.accountId === null;
  }

  reasonFor(item: BatchFile): string {
    return NEEDS_ACCOUNT_REASONS[item.matchReason];
  }

  sizeLabel(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
