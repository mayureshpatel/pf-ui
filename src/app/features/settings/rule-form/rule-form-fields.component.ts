import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  InputSignal,
  Signal,
  viewChild,
} from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MATCH_TYPE_OPTIONS } from './rule-form-base';

/**
 * The fields every rule form shares: keywords, match any/all, priority and the amount range. The
 * rule's target (a category, a merchant) is projected between match and priority. It binds to the
 * enclosing `[formGroup]` (the host form's), so it needs no form of its own; the host passes down
 * the messages it works out.
 */
@Component({
  selector: 'app-rule-form-fields',
  standalone: true,
  imports: [ReactiveFormsModule, InputNumberModule, InputTextModule, SelectModule],
  templateUrl: './rule-form-fields.component.html',
  // the enclosing form's group, so the controls below find it across this component's own view
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleFormFieldsComponent {
  readonly keywordsError: InputSignal<string | null> = input<string | null>(null);
  readonly priorityError: InputSignal<string | null> = input<string | null>(null);
  readonly amountError: InputSignal<string | null> = input<string | null>(null);

  protected readonly matchTypeOptions = MATCH_TYPE_OPTIONS;

  private readonly keywordsField: Signal<ElementRef<HTMLInputElement> | undefined> =
    viewChild<ElementRef<HTMLInputElement>>('keywordsField');

  /** Moves focus to the keywords field. */
  focusKeywords(): void {
    this.keywordsField()?.nativeElement.focus();
  }
}
