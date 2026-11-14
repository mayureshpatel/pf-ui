import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { RuleChangePreview } from '@models/category-rule.model';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';

/**
 * Dialog for previewing and confirming bulk rule applications -- shows users which transactions
 * will be affected before execution. Used by category rules and merchant rules; the fieldLabel input
 * keeps it generic rather than hardcoded to one field.
 */
@Component({
  selector: 'app-apply-rules-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TableModule, RestoreFocusOnHideDirective],
  templateUrl: './apply-rules-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyRulesDialogComponent {
  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The list of projected changes. */
  readonly previewItems: InputSignal<RuleChangePreview[]> = input.required<RuleChangePreview[]>();

  /** Functional label for the value being changed (e.g., "Category", "Merchant"). */
  readonly fieldLabel: InputSignal<string> = input<string>('Value');

  /** Global loading state for the apply operation. */
  readonly loading: InputSignal<boolean> = input<boolean>(false);

  /** Emitted when the user confirms the bulk application. */
  readonly confirm: OutputEmitterRef<void> = output<void>();

  /** Total number of transactions identified for update. */
  readonly totalCount: Signal<number> = computed((): number => this.previewItems().length);

  /** Whether the changes say which rule decides them, which adds a "Decided by" column. */
  readonly showsRule: Signal<boolean> = computed((): boolean =>
    this.previewItems().some((item: RuleChangePreview): boolean => !!item.decidedBy),
  );

  /** Indicates if the update volume is high enough to warrant a warning. */
  /** The confirm button says how many changes it will make. */
  readonly applyLabel: Signal<string> = computed((): string => {
    const count: number = this.totalCount();
    return `Apply ${count} ${count === 1 ? 'change' : 'changes'}`;
  });

  readonly isLargeUpdate: Signal<boolean> = computed((): boolean => this.totalCount() > 50);

  /**
   * Closes the dialog.
   */
  onCancel(): void {
    this.visible.set(false);
  }

  /**
   * Triggers the confirmation event.
   */
  onConfirm(): void {
    this.confirm.emit();
  }
}
