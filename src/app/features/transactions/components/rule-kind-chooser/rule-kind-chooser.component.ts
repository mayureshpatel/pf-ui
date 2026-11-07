import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { RULE_KIND_LABELS, RuleKind } from '../../utils/rule-kind';

let nextId = 0;

/**
 * The choice at the top of the ledger's rule panel between a category rule, a merchant rule and,
 * when offered, both (PF-931). A native radio group, so the arrow keys, focus and screen reader
 * naming all work without extra code.
 */
@Component({
  selector: 'app-rule-kind-chooser',
  standalone: true,
  templateUrl: './rule-kind-chooser.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleKindChooserComponent {
  /** The chosen kind. */
  readonly kind: InputSignal<RuleKind> = input.required<RuleKind>();

  /** The kinds on offer, in order. */
  readonly options: InputSignal<RuleKind[]> = input<RuleKind[]>(['category', 'merchant']);

  /** Emits the kind the user picked. */
  readonly kindChange: OutputEmitterRef<RuleKind> = output<RuleKind>();

  protected readonly labels: Record<RuleKind, string> = RULE_KIND_LABELS;
  protected readonly groupName: string = `rule-kind-${nextId++}`;
}
