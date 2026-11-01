import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Dialog, DialogModule } from 'primeng/dialog';

import { Account } from '@models/account.model';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';
import { BatchFile, CsvImportBatchStore, ReviewRow } from './csv-import-batch.store';
import { CsvImportFilesStepComponent } from './csv-import-files-step.component';
import { CsvImportResultStepComponent } from './csv-import-result-step.component';
import { CsvImportReviewStepComponent } from './csv-import-review-step.component';

export type ImportStep = 'files' | 'review' | 'result';

interface StepInfo {
  id: ImportStep;
  label: string;
  heading: string;
}

const STEPS: StepInfo[] = [
  { id: 'files', label: 'Files', heading: 'Choose files' },
  { id: 'review', label: 'Review & edit', heading: 'Review & edit transactions' },
  { id: 'result', label: 'Result', heading: 'Import result' },
];

/**
 * The Transactions page's CSV import dialog (PF-898): a three-step wizard, Files -> Review & edit
 * -> Result, over a {@link CsvImportBatchStore} scoped to this dialog. Nothing is saved until the
 * user imports from the Review step; the Result step reports every file's outcome and offers,
 * without opening it, the transfer review.
 *
 * Cancel, the close button and Escape all ask before throwing away chosen files or review edits;
 * once the batch has been committed there is nothing left to lose and they just close.
 */
@Component({
  selector: 'app-csv-import-dialog',
  standalone: true,
  imports: [
    DialogModule,
    RestoreFocusOnHideDirective,
    CsvImportFilesStepComponent,
    CsvImportReviewStepComponent,
    CsvImportResultStepComponent,
  ],
  providers: [CsvImportBatchStore],
  templateUrl: './csv-import-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape($event)' },
})
export class CsvImportDialogComponent {
  private readonly store: CsvImportBatchStore = inject(CsvImportBatchStore);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly injector: Injector = inject(Injector);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The user's accounts, for file-name matching and the per-file account choice. */
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();

  /** Emitted once per commit (or retry) that imported at least one file, so the list reloads. */
  readonly importComplete: OutputEmitterRef<void> = output<void>();

  /** The user asked to review possible transfers; emitted after this dialog has closed. */
  readonly reviewTransfers: OutputEmitterRef<void> = output<void>();

  readonly steps: StepInfo[] = STEPS;
  readonly step: WritableSignal<ImportStep> = signal('files');
  readonly currentStep: Signal<StepInfo> = computed((): StepInfo =>
    STEPS.find((s: StepInfo): boolean => s.id === this.step())!,
  );
  readonly stepIndex: Signal<number> = computed((): number =>
    STEPS.findIndex((s: StepInfo): boolean => s.id === this.step()),
  );

  readonly previewing: Signal<boolean> = this.store.previewing;
  readonly committing: Signal<boolean> = this.store.committing;
  readonly canPreview: Signal<boolean> = this.store.canPreview;
  readonly canCommit: Signal<boolean> = this.store.canCommit;
  readonly previewProgress = this.store.previewProgress;

  /** Files whose preview failed, listed on the Files step so a failed Preview never strands. */
  readonly unreadableFiles: Signal<BatchFile[]> = computed((): BatchFile[] =>
    this.store
      .items()
      .filter((f: BatchFile): boolean => f.status === 'failed' && f.failedAt === 'preview'),
  );

  /** Rows the Import button will send: rows of ready files not flagged to be skipped. */
  readonly importCount: Signal<number> = computed((): number =>
    this.store
      .items()
      .filter((f: BatchFile): boolean => f.status === 'ready')
      .reduce(
        (sum: number, f: BatchFile): number =>
          sum + f.rows.filter((r: ReviewRow): boolean => r.skip === null).length,
        0,
      ),
  );

  private readonly committedCount: Signal<number> = computed(
    (): number =>
      this.store.items().filter((f: BatchFile): boolean => f.status === 'committed').length,
  );

  private readonly dialog = viewChild(Dialog);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  /** Committed files already reported through {@link importComplete}. */
  private reportedCommitted = 0;
  /** Set when the user chose to review transfers; {@link reviewTransfers} waits for the hide. */
  private transfersRequested = false;

  constructor() {
    effect((): void => this.store.setAccounts(this.accounts()));
    effect((): void => {
      const committed: number = this.committedCount();
      if (committed > this.reportedCommitted) {
        untracked((): void => this.importComplete.emit());
      }
      this.reportedCommitted = committed;
    });
  }

  /** Previews the batch, then moves to Review when at least one file can be reviewed. */
  async preview(): Promise<void> {
    if (!this.canPreview()) return;
    await this.store.previewAll();
    if (this.step() !== 'files') return;
    const items: BatchFile[] = this.store.items();
    const unfinished: boolean = items.some(
      (f: BatchFile): boolean => f.status === 'pending' || f.status === 'previewing',
    );
    // a cancelled run leaves pending files; with nothing readable the failures stay on Files
    if (!unfinished && items.some((f: BatchFile): boolean => f.status === 'ready')) {
      this.goTo('review');
    }
  }

  /** Stops a running preview; finished files keep their results. */
  stopPreview(): void {
    this.store.cancelPreview();
  }

  back(): void {
    if (this.committing()) return;
    this.goTo('files');
  }

  async commit(): Promise<void> {
    if (!this.canCommit()) return;
    await this.store.commit();
    this.goTo('result');
  }

  /** Cancel, the close button and Escape: asks first when files or edits would be lost. */
  requestClose(): void {
    if (this.committing()) return;
    if (this.step() === 'result' || this.store.items().length === 0) {
      this.close();
      return;
    }
    this.confirmationService.confirm({
      header: 'Discard import?',
      message: 'The files you chose and any edits you made will be lost. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep importing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => this.close(),
    });
  }

  /** Escape inside this dialog (not in a dropdown, which handles its own) acts like Cancel. */
  onEscape(event: Event): void {
    if (!this.visible() || event.defaultPrevented) return;
    const container: HTMLElement | null | undefined = this.dialog()?.container();
    if (!container || !container.contains(event.target as Node)) return;
    event.preventDefault();
    this.requestClose();
  }

  /** Closes this dialog first, so focus returns to the page before the transfer dialog opens. */
  onReviewTransfers(): void {
    this.transfersRequested = true;
    this.close();
  }

  onShow(): void {
    this.focusHeading();
  }

  onHide(): void {
    if (!this.transfersRequested) return;
    this.transfersRequested = false;
    this.reviewTransfers.emit();
  }

  private close(): void {
    this.store.reset();
    this.step.set('files');
    this.visible.set(false);
  }

  private goTo(step: ImportStep): void {
    this.step.set(step);
    this.focusHeading();
  }

  private focusHeading(): void {
    afterNextRender((): void => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
}
