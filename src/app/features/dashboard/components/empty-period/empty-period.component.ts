import { ChangeDetectionStrategy, Component, input, InputSignal } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

/** The most recent month that has data, with the dashboard link that opens it. */
export interface LatestData {
  /** The month as people say it, for example "August 2026". */
  label: string;
  /** The dashboard query params that select that month. */
  link: Params;
}

/**
 * Stands in for the income, expenses and kept cards when the selected period has nothing in it.
 *
 * Zero against a prior figure reads as a 100% change, and with expenses it even reads as good
 * news, so an empty period gets one plain statement instead, plus a way to the latest data.
 */
@Component({
  selector: 'app-empty-period',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './empty-period.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyPeriodComponent {
  /** The period as people say it, for example "October 2026". */
  readonly periodLabel: InputSignal<string> = input.required<string>();

  /** The latest month with data to offer a jump to, or null when there is none to offer. */
  readonly latest: InputSignal<LatestData | null> = input<LatestData | null>(null);
}
