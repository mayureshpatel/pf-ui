import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  viewChild,
} from '@angular/core';
import { LookAlikeWarning } from '@models/merchant.model';
import { warnedDescriptions, warningText } from '../../utils/link-helpers';

/** Numbers each guard's title id. */
let nextGuardId = 0;

/**
 * The look-alike guard shown before a link goes ahead: one sentence per flagged group ("4 of these
 * contain FUEL, which Kroger doesn't. Kroger Fuel Center exists.") with "Leave those out" and
 * "Link anyway". Focus moves to the first choice when it appears, and Escape cancels.
 */
@Component({
  selector: 'app-link-guard',
  standalone: true,
  templateUrl: './link-guard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkGuardComponent {
  readonly targetName: InputSignal<string> = input.required<string>();
  readonly warnings: InputSignal<LookAlikeWarning[]> = input.required<LookAlikeWarning[]>();
  /** Every description about to be linked, warned or not. */
  readonly descriptions: InputSignal<string[]> = input.required<string[]>();

  /** Emits the descriptions left once the warned ones are taken out (possibly none). */
  readonly leaveOut: OutputEmitterRef<string[]> = output<string[]>();
  readonly linkAnyway: OutputEmitterRef<string[]> = output<string[]>();
  /** Escape: back to where the link was asked for, nothing linked. */
  readonly dismiss: OutputEmitterRef<void> = output<void>();

  /** Unique per guard, so two guards on one page never share a label. */
  readonly titleId: string = `link-guard-title-${nextGuardId++}`;

  private readonly firstChoice = viewChild<ElementRef<HTMLButtonElement>>('firstChoice');

  readonly sentences: Signal<string[]> = computed((): string[] =>
    this.warnings().map((w: LookAlikeWarning): string =>
      warningText(w, this.descriptions().length, this.targetName()),
    ),
  );
  readonly remaining: Signal<string[]> = computed((): string[] => {
    const warned: Set<string> = warnedDescriptions(this.warnings());
    return this.descriptions().filter((d: string): boolean => !warned.has(d));
  });
  readonly leaveOutLabel: Signal<string> = computed((): string => {
    const left: number = this.remaining().length;
    if (left === 0) return "Don't link these";
    return `Leave those out, link ${left}`;
  });

  constructor() {
    afterNextRender((): void => this.firstChoice()?.nativeElement.focus());
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.dismiss.emit();
  }
}
