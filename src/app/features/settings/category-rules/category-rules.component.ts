import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {finalize} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {ConfirmationService} from 'primeng/api';
import {TooltipModule} from 'primeng/tooltip';

import {CategoryRule} from '@models/category-rule.model';
import {CategoryRuleApiService} from './services/category-rule-api.service';
import {ToastService} from '@core/services/toast.service';
import {
  CategoryRuleFormDialogComponent
} from './components/category-rule-form-dialog/category-rule-form-dialog.component';
import {
  ApplyRulesDialogComponent,
  RuleChangePreview
} from '@features/settings/vendor-rules/components/apply-rules-dialog/apply-rules-dialog.component';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

/**
 * Component for managing transaction categorization rules.
 *
 * Allows users to define keyword-based rules that automatically assign
 * categories to incoming transactions. Includes a preview and apply
 * engine for bulk updates.
 */
@Component({
  selector: 'app-category-rules',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    TooltipModule,
    ScreenToolbarComponent,
    CategoryRuleFormDialogComponent,
    ApplyRulesDialogComponent
  ],
  templateUrl: './category-rules.component.html'
})
export class CategoryRulesComponent implements OnInit {
  private readonly api: CategoryRuleApiService = inject(CategoryRuleApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The list of active categorization rules. */
  readonly rules: WritableSignal<CategoryRule[]> = signal([]);

  /** Global loading state for API operations. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Visibility of the rule creation dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** Visibility of the bulk application preview dialog. */
  readonly showApplyDialog: WritableSignal<boolean> = signal(false);

  /** Transactions identified for potential updates during preview. */
  readonly previewItems: WritableSignal<RuleChangePreview[]> = signal([]);

  /** Indicates if no rules have been defined yet. */
  readonly isEmpty: Signal<boolean> = computed((): boolean => this.rules().length === 0 && !this.loading());

  /**
   * Initializes component data on load.
   */
  ngOnInit(): void {
    this.loadRules();
  }

  /**
   * Fetches the current ruleset from the API.
   */
  loadRules(): void {
    this.loading.set(true);
    this.api.getRules()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (data: CategoryRule[]): void => this.rules.set(data),
        error: (err: any): void => {
          console.error('Failed to load rules:', err);
          this.toast.error('Failed to load category rules.');
        }
      });
  }

  /**
   * Opens the rule creation dialog.
   */
  openCreateDialog(): void {
    this.showDialog.set(true);
  }

  /**
   * Refreshes the list after a new rule is saved.
   */
  onRuleSaved(): void {
    this.showDialog.set(false);
    this.loadRules();
  }

  /**
   * Generates a preview of transactions that would be affected by the current ruleset.
   * Opens the apply dialog if changes are found.
   */
  openApplyPreview(): void {
    this.loading.set(true);
    this.api.previewApply()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
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
        error: (err: any): void => {
          console.error('Preview failed:', err);
          this.toast.error(err.error?.detail || 'Failed to generate rule preview.');
        }
      });
  }

  /**
   * Executes the bulk rule application on the backend.
   */
  confirmApply(): void {
    this.loading.set(true);
    this.api.applyRules()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (): void => {
          this.showApplyDialog.set(false);
          this.toast.success('Rules successfully applied to transactions.');
          this.loadRules();
        },
        error: (err: any): void => {
          console.error('Rule application failed:', err);
          this.toast.error(err.error?.detail || 'Failed to apply rules.');
        }
      });
  }

  /**
   * Deletes a specific rule after confirmation.
   * @param rule - The rule to remove.
   */
  deleteRule(rule: CategoryRule): void {
    this.confirmationService.confirm({
      header: 'Delete Rule?',
      message: `Are you sure you want to delete the rule for keyword "${rule.keyword}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.api.deleteRule(rule.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Rule deleted.');
              this.rules.update((list: CategoryRule[]): CategoryRule[] => list.filter((r: CategoryRule): boolean => r.id !== rule.id));
            },
            error: (err: any): void => {
              console.error('Delete failed:', err);
              this.toast.error('Failed to delete rule.');
            }
          });
      }
    });
  }
}
