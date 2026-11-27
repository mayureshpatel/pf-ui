import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { LastLink, lastLinkText, UndoOutcome, undoneText } from '../../utils/link-helpers';

/**
 * The status line after a link: "Linked 11 to Kroger · 205 transactions filled · Undo", announced
 * to screen readers. After Undo it says what was taken back. The owner keeps the state and does
 * the undo; this only shows it. The owner keeps this element on the page even with no link, so
 * the live region exists before its text changes; many screen readers skip a region that appears
 * already holding text.
 */
@Component({
  selector: 'app-link-result',
  standalone: true,
  templateUrl: './link-result.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkResultComponent {
  /** The link to report, or null for nothing shown (the live region stays, empty). */
  readonly link: InputSignal<LastLink | null> = input.required<LastLink | null>();
  readonly undoing: InputSignal<boolean> = input<boolean>(false);
  /** Set once Undo has run, so the line reports it instead of offering it again. */
  readonly undone: InputSignal<UndoOutcome | null> = input<UndoOutcome | null>(null);

  readonly undo: OutputEmitterRef<void> = output<void>();
  readonly dismiss: OutputEmitterRef<void> = output<void>();

  readonly text: Signal<string> = computed((): string => {
    const link: LastLink | null = this.link();
    if (!link) return '';
    const outcome: UndoOutcome | null = this.undone();
    return outcome ? undoneText(outcome) : lastLinkText(link);
  });
}
