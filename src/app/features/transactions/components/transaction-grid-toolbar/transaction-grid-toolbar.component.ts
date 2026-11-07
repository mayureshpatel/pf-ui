import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { GridHighlights, NO_HIGHLIGHTS } from '../../utils/grid-highlights';

/**
 * The strip of controls directly above the transactions grid, whose functions act on the grid
 * (PF-923). It holds the Create rule button and the row highlight switches (PF-924). Create rule
 * starts one rule for the ticked rows, so it is disabled, with a visible hint, until a row is
 * ticked. The highlight switches combine and are owned by the page, which passes them back in.
 */
@Component({
  selector: 'app-transaction-grid-toolbar',
  standalone: true,
  templateUrl: './transaction-grid-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionGridToolbarComponent {
  /** How many rows are ticked; Create rule needs at least one. */
  readonly selectionCount: InputSignal<number> = input.required<number>();

  /** Which highlights are on. */
  readonly highlights: InputSignal<GridHighlights> = input<GridHighlights>(NO_HIGHLIGHTS);

  /** Emits the complete new highlights whenever a switch is toggled. */
  readonly highlightsChange: OutputEmitterRef<GridHighlights> = output<GridHighlights>();

  /** Starts one rule for the ticked rows (the page decides the keyword and the panel). */
  readonly createRule: OutputEmitterRef<void> = output<void>();

  /** Emits only when rows are ticked, so a disabled-looking click can never start a rule. */
  onCreateRule(): void {
    if (this.selectionCount() > 0) {
      this.createRule.emit();
    }
  }

  /** Flips one highlight, keeping the others as they are. */
  toggle(key: keyof GridHighlights): void {
    this.highlightsChange.emit({ ...this.highlights(), [key]: !this.highlights()[key] });
  }
}
