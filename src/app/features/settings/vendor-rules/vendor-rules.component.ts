import {Component, inject, OnInit, signal, WritableSignal, DestroyRef} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {ConfirmationService} from 'primeng/api';
import {VendorRule, UnmatchedVendor} from '@models/vendor-rule.model';
import {VendorRuleApiService} from './services/vendor-rule-api.service';
import {ToastService} from '@core/services/toast.service';
import {
  VendorRuleFormDrawerComponent
} from '@shared/components/vendor-rule-form-drawer/vendor-rule-form-drawer.component';
import {ApplyRulesDialogComponent, RuleChangePreview} from './components/apply-rules-dialog/apply-rules-dialog.component';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

@Component({
  selector: 'app-vendor-rules',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    ScreenToolbarComponent,
    VendorRuleFormDrawerComponent,
    ApplyRulesDialogComponent
  ],
  templateUrl: './vendor-rules.component.html'
})
export class VendorRulesComponent implements OnInit {
  private readonly api = inject(VendorRuleApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  rules: WritableSignal<VendorRule[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showApplyDialog: WritableSignal<boolean> = signal(false);
  previewItems: WritableSignal<RuleChangePreview[]> = signal([]);
  unmatchedVendors: WritableSignal<UnmatchedVendor[]> = signal([]);
  initialKeyword: WritableSignal<string> = signal('');

  ngOnInit(): void {
    this.loadRules();
    this.loadUnmatchedVendors();
  }

  loadRules(): void {
    this.loading.set(true);
    this.api.getRules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.rules.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Failed to load rules');
          this.loading.set(false);
        }
      });
  }

  loadUnmatchedVendors(): void {
    this.api.getUnmatchedVendors()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.unmatchedVendors.set(data),
        error: () => {}
      });
  }

  openCreateDialog(): void {
    this.initialKeyword.set('');
    this.showDialog.set(true);
  }

  onRuleSaved(): void {
    this.showDialog.set(false);
    this.loadRules();
    this.loadUnmatchedVendors();
  }

  openApplyPreview(): void {
    this.api.previewApply()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (items.length === 0) {
            this.toast.info('No changes to apply');
            return;
          }
          this.previewItems.set(items);
          this.showApplyDialog.set(true);
        },
        error: (error) => {
          this.toast.error(error.error?.detail || 'Failed to load preview');
        }
      });
  }

  confirmApply(): void {
    this.api.applyRules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showApplyDialog.set(false);
          this.toast.success('Rules applied to existing transactions');
          this.loadRules();
          this.loadUnmatchedVendors();
        },
        error: (error) => {
          this.toast.error(error.error?.detail || 'Failed to apply rules');
        }
      });
  }

  createRuleFromUnmatched(vendor: UnmatchedVendor): void {
    this.initialKeyword.set(vendor.originalName);
    this.showDialog.set(true);
  }

  deleteRule(rule: VendorRule): void {
    this.confirmationService.confirm({
      header: 'Delete Rule?',
      message: `Are you sure you want to delete the rule for "${rule.keyword}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteRule(rule.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.success('Rule deleted successfully');
              this.rules.update(current => current.filter(r => r.id !== rule.id));
              this.loadUnmatchedVendors();
            },
            error: (error) => {
              this.toast.error(error.error?.detail || 'Failed to delete rule');
            }
          });
      }
    });
  }
}
