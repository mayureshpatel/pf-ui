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
import { DialogModule } from 'primeng/dialog';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';

/**
 * Asks how to copy last month's limits into this month: only fill the categories that have no limit
 * yet, or replace the limits that differ. (ConfirmationService offers only two buttons.)
 */
@Component({
  selector: 'app-budget-copy-dialog',
  standalone: true,
  imports: [DialogModule, RestoreFocusOnHideDirective],
  templateUrl: './budget-copy-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetCopyDialogComponent {
  readonly visible: ModelSignal<boolean> = model.required<boolean>();
  readonly fromName: InputSignal<string> = input.required<string>();
  readonly toName: InputSignal<string> = input.required<string>();
  /** Categories that would get a new limit. */
  readonly addCount: InputSignal<number> = input.required<number>();
  /** Categories whose existing limit would change. */
  readonly overwriteCount: InputSignal<number> = input.required<number>();

  readonly fill: OutputEmitterRef<void> = output<void>();
  readonly replace: OutputEmitterRef<void> = output<void>();

  readonly title: Signal<string> = computed(
    (): string => `Copy ${this.fromName()}'s limits to ${this.toName()}?`,
  );

  onFill(): void {
    this.fill.emit();
    this.visible.set(false);
  }

  onReplace(): void {
    this.replace.emit();
    this.visible.set(false);
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
