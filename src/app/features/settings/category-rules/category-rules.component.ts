import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { Category, CategoryGroup } from '@models/category.model';
import {
  CategoryRule,
  CategoryRuleCreateRequest,
  CategoryRuleUpdateRequest,
  RuleChangePreview,
} from '@models/category-rule.model';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { getCategoryColor } from '@shared/utils/category.utils';
import { SettingsGuard } from '../settings.guard';
import { amountLimitText, filterRules, sortRules } from '../utils/settings-helpers';
import { ApplyRulesDialogComponent } from './components/apply-rules-dialog/apply-rules-dialog.component';
import {
  RuleCreateValue,
  RuleEditFormComponent,
} from './components/rule-edit-form/rule-edit-form.component';
import { CategoryRuleApiService } from './services/category-rule-api.service';

type RulePanelMode = 'overview' | 'rule' | 'add';

/**
 * The Category rules section: the rules sorted by priority beside an always-present panel (overview, the
 * selected rule, add). Rules assign a category to imported transactions whose description contains a
 * keyword. Owns loading, the discard prompt, saving, deleting and the Apply preview.
 */
@Component({
  selector: 'app-category-rules',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    SidePanelComponent,
    RuleEditFormComponent,
    ApplyRulesDialogComponent,
    PageErrorStateComponent,
  ],
  templateUrl: './category-rules.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryRulesComponent implements OnInit {
  private readonly api: CategoryRuleApiService = inject(CategoryRuleApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);
  private readonly guard: SettingsGuard | null = inject(SettingsGuard, { optional: true });

  protected readonly rules: WritableSignal<CategoryRule[]> = signal([]);
  protected readonly groups: WritableSignal<CategoryGroup[]> = signal([]);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly loadError: WritableSignal<boolean> = signal(false);
  /** First-load skeleton only; later reloads dim the list and keep the panel mounted. */
  protected readonly loadedOnce: WritableSignal<boolean> = signal(false);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly applying: WritableSignal<boolean> = signal(false);
  protected readonly search: WritableSignal<string> = signal('');
  protected readonly panelMode: WritableSignal<RulePanelMode> = signal('overview');
  protected readonly selectedRuleId: WritableSignal<number | null> = signal(null);
  protected readonly showApplyDialog: WritableSignal<boolean> = signal(false);
  protected readonly previewItems: WritableSignal<RuleChangePreview[]> = signal([]);

  protected readonly visibleRules: Signal<CategoryRule[]> = computed((): CategoryRule[] =>
    sortRules(filterRules(this.rules(), this.search())),
  );
  protected readonly selectedRule: Signal<CategoryRule | null> = computed(
    (): CategoryRule | null =>
      this.rules().find((r: CategoryRule): boolean => r.id === this.selectedRuleId()) ?? null,
  );
  /** With no rules the add form is the only useful mode, so it has no Back or Close. */
  protected readonly onlyAddMode: Signal<boolean> = computed(
    (): boolean =>
      this.loadedOnce() &&
      this.rules().length === 0 &&
      !this.loading() &&
      !this.loadError() &&
      this.panelMode() === 'add',
  );
  protected readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.panelMode()) {
      case 'add':
        return 'Add rule';
      case 'rule':
        return 'Edit rule';
      default:
        return 'Overview';
    }
  });

  private readonly panel = viewChild(SidePanelComponent);
  protected readonly ruleForm = viewChild<RuleEditFormComponent>('ruleForm');
  private loadSubscription: Subscription | null = null;
  private loadRun = 0;
  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;

  private readonly isDirty = (): boolean =>
    this.panelMode() !== 'overview' && !!this.ruleForm()?.form.dirty;

  constructor() {
    this.guard?.register(this.isDirty);
    this.destroyRef.onDestroy((): void => this.guard?.unregister(this.isDirty));
  }

  ngOnInit(): void {
    this.loadRules();
    this.loadGroups();
  }

  // ---- loading ----

  /** Loads the rules; a newer load replaces an older one. `afterLoad` runs once they have arrived. */
  loadRules(afterLoad?: () => void): void {
    this.loadSubscription?.unsubscribe();
    const run: number = ++this.loadRun;
    this.loading.set(true);
    this.loadError.set(false);
    this.loadSubscription = this.api
      .getRules()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (data: CategoryRule[]): void => {
          this.rules.set(data);
          this.loadedOnce.set(true);
          this.afterRulesLoaded(data);
          afterLoad?.();
        },
        error: (err: unknown): void => {
          console.error('Failed to load rules:', err);
          this.toast.error('Failed to load category rules.');
          this.rules.set([]);
          this.loadError.set(true);
        },
      });
  }

  private afterRulesLoaded(data: CategoryRule[]): void {
    if (data.length === 0) {
      this.selectedRuleId.set(null);
      this.panelMode.set('add');
      return;
    }
    if (
      this.panelMode() === 'rule' &&
      !data.some((r: CategoryRule) => r.id === this.selectedRuleId())
    ) {
      this.toast.info('That rule no longer exists.');
      this.closePanel();
    }
  }

  private loadGroups(): void {
    this.categoryApi
      .getGroupedCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups: CategoryGroup[]): void => this.groups.set(groups),
        error: (err: unknown): void => {
          console.error('Failed to load categories:', err);
          this.toast.error('Failed to load categories.');
        },
      });
  }

  // ---- panel ----

  readonly color = (category: Category | null): string =>
    category ? category.color || getCategoryColor(category.name) : 'var(--p-surface-400)';
  readonly limitText = amountLimitText;

  openRule(rule: CategoryRule): void {
    if (this.panelMode() === 'rule' && this.selectedRuleId() === rule.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedRuleId.set(rule.id);
      this.go('rule');
    });
  }

  startAdd(): void {
    if (this.panelMode() === 'add') return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedRuleId.set(null);
      this.go('add');
    });
  }

  /** Back: add returns to the overview, as does an open rule. */
  back(): void {
    if (this.panelMode() === 'overview') return;
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  closePanel(): void {
    this.selectedRuleId.set(null);
    this.go('overview');
  }

  /** Close button and Escape: asks first when there are unsaved edits; the overview ignores them. */
  onPanelClose(): void {
    if (this.panelMode() === 'overview' || this.onlyAddMode()) return;
    this.back();
  }

  /** The panel's Save button: submits the form that is showing. */
  onPanelSave(): void {
    this.ruleForm()?.submit();
  }

  clearSearch(): void {
    this.search.set('');
  }

  // ---- saving and deleting ----

  /** Saves the form: an update when a rule is open, otherwise a create. */
  saveRule(request: RuleCreateValue | CategoryRuleUpdateRequest): void {
    if (this.saving()) return;
    this.saving.set(true);
    const editing: boolean = 'id' in request;
    const call =
      'id' in request
        ? this.api.updateRule(request)
        : this.api.createRule(request as CategoryRuleCreateRequest);
    call
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (id: number): void => {
          this.ruleForm()?.form.markAsPristine();
          this.toast.success(editing ? 'Rule saved' : 'Rule added');
          this.loadRules((): void => {
            this.selectedRuleId.set(id);
            this.go('rule');
          });
        },
        error: (err: HttpErrorResponse): void => {
          console.error('Saving the rule failed:', err);
          this.ruleForm()?.errorMessage.set(err.error?.detail || 'Failed to save the rule.');
        },
      });
  }

  /** Asks, then deletes the open rule. */
  deleteSelected(): void {
    const rule: CategoryRule | null = this.selectedRule();
    if (!rule) return;
    this.confirmationService.confirm({
      header: 'Delete rule?',
      message: `Delete the rule for "${rule.keywords.join(', ')}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => this.performDelete(rule),
    });
  }

  private performDelete(rule: CategoryRule): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .deleteRule(rule.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Rule deleted');
          this.ruleForm()?.form.markAsPristine();
          this.closePanel();
          this.loadRules();
        },
        error: (err: HttpErrorResponse): void => {
          console.error('Delete failed:', err);
          this.toast.error(err.error?.detail || 'Failed to delete rule.');
        },
      });
  }

  // ---- apply ----

  /** Previews the transactions the current rules would change; opens the dialog when there are any. */
  openApplyPreview(): void {
    if (this.applying()) return;
    this.applying.set(true);
    this.api
      .previewApply()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.applying.set(false)),
      )
      .subscribe({
        next: (items: RuleChangePreview[]): void => {
          if (items.length === 0) {
            this.toast.info('No pending transactions match your current rules.');
            return;
          }
          this.previewItems.set(items);
          this.showApplyDialog.set(true);
        },
        error: (err: HttpErrorResponse): void => {
          console.error('Preview failed:', err);
          this.toast.error(err.error?.detail || 'Failed to generate rule preview.');
        },
      });
  }

  confirmApply(): void {
    if (this.applying()) return;
    this.applying.set(true);
    this.api
      .applyRules()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.applying.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.showApplyDialog.set(false);
          this.toast.success('Rules successfully applied to transactions.');
          this.loadRules();
        },
        error: (err: HttpErrorResponse): void => {
          console.error('Rule application failed:', err);
          this.toast.error(err.error?.detail || 'Failed to apply rules.');
        },
      });
  }

  // ---- internals ----

  /** Runs an action that would replace a form, after asking when that form has unsaved changes. */
  private confirmDiscardIfDirty(proceed: () => void): void {
    if (!this.isDirty()) {
      proceed();
      return;
    }
    this.confirmationService.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
    });
  }

  /** Switches mode and moves focus: into the panel for any step, back to the opener for overview. */
  private go(mode: RulePanelMode): void {
    if (mode === 'overview' && this.panelMode() === 'overview') return;
    if (this.panelMode() === 'overview' && mode !== 'overview') {
      this.focusReturn = document.activeElement as HTMLElement | null;
    }
    this.panelMode.set(mode);
    afterNextRender(
      (): void => {
        const target: HTMLElement | null = this.focusReturn;
        if (mode === 'overview' && target?.isConnected) {
          target.focus();
        } else {
          this.panel()?.focus();
        }
        if (mode === 'overview') this.focusReturn = null;
      },
      { injector: this.injector },
    );
  }
}
