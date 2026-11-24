import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { amountLimitText } from '../utils/settings-helpers';

/** The slice of a rule the row shows; both rule kinds satisfy it. */
export interface RuleRowData {
  keywords: string[];
  matchType: string;
  minAmount: number | null;
  maxAmount: number | null;
  priority: number;
}

/**
 * One rule in the Category or Merchant rules list: its keywords, the target (projected, since a
 * category and a merchant look different), the amount limits and, when it is not the default, the
 * priority. The button's accessible name reads as sentences, not a run of chips.
 */
@Component({
  selector: 'app-rule-row',
  standalone: true,
  templateUrl: './rule-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleRowComponent {
  readonly rule: InputSignal<RuleRowData> = input.required<RuleRowData>();
  readonly selected: InputSignal<boolean> = input<boolean>(false);
  /** Spoken before the projected target, e.g. "Category". */
  readonly targetLabel: InputSignal<string> = input.required<string>();

  protected readonly limits: Signal<string> = computed((): string =>
    amountLimitText(this.rule().minAmount, this.rule().maxAmount),
  );
}
