import {Component, DestroyRef, inject, OnInit, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {ConfirmationService} from 'primeng/api';
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
import {finalize} from 'rxjs';
import {Tooltip} from 'primeng/tooltip';

@Component({
  selector: 'app-category-rules',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    ScreenToolbarComponent,
    CategoryRuleFormDialogComponent,
    ApplyRulesDialogComponent,
    Tooltip
  ],
  templateUrl: './category-rules.component.html'
})
export class CategoryRulesComponent implements OnInit {
  // injected services
  private readonly api: CategoryRuleApiService = inject(CategoryRuleApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // signals
  rules: WritableSignal<CategoryRule[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showApplyDialog: WritableSignal<boolean> = signal(false);
  previewItems: WritableSignal<RuleChangePreview[]> = signal([]);

  ngOnInit(): void {
    this.loadRules();
  }

  loadRules(): void {
    this.loading.set(true);

    this.api.getRules()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (data: CategoryRule[]): void => {
          this.rules.set(data);
        },
        error: (error: any): void => {
          console.error('Error loading rules:', error);
          this.toast.error('Failed to load rules');
        }
      });
  }

  openCreateDialog(): void {
    this.showDialog.set(true);
  }

  onRuleSaved(): void {
    this.showDialog.set(false);
    this.loadRules();
  }

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
            this.toast.info('No changes to apply');
            return;
          }

          this.previewItems.set(items);
          this.showApplyDialog.set(true);
        },
        error: (error: any): void => {
          console.error('Error loading preview:', error);
          this.toast.error(error.error?.detail || 'Failed to load preview');
        }
      });
  }

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
          this.toast.success('Rules applied to uncategorized transactions');
          this.loadRules();
        },
        error: (error: any): void => {
          console.error('Error applying rules:', error);
          this.toast.error(error.error?.detail || 'Failed to apply rules');
        }
      });
  }

  deleteRule(rule: CategoryRule): void {
    this.confirmationService.confirm({
      header: 'Delete Rule?',
      message: `Are you sure you want to delete the rule for "${rule.keyword}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.loading.set(true);

        this.api.deleteRule(rule.id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize((): void => this.loading.set(false))
          )
          .subscribe({
            next: (): void => {
              this.toast.success('Rule deleted successfully');
              this.rules.update((current: CategoryRule[]): CategoryRule[] => current.filter((r: CategoryRule): boolean => r.id !== rule.id));
            },
            error: (error: any): void => {
              console.error('Error deleting rule:', error);
              this.toast.error(error.error?.detail || 'Failed to delete rule');
            }
          });
      }
    });
  }
}
