import { ChangeDetectionStrategy, Component, input, InputSignal, output, OutputEmitterRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** The tabs that are real list filters. */
export type ReviewTab = 'ALL' | 'NEEDS_CATEGORY';

/**
 * The tab strip above the transaction list: All, Needs a category (a filter), and an entry that
 * opens the possible-transfers review (not a filter, because suggestions are pairs from their own
 * endpoint).
 */
@Component({
  selector: 'app-transaction-review-tabs',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './transaction-review-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionReviewTabsComponent {
  /** The tab whose filter is currently applied. */
  readonly activeTab: InputSignal<ReviewTab> = input.required<ReviewTab>();

  /** How many uncategorized expenses exist (global, not narrowed by other filters). */
  readonly uncategorizedCount: InputSignal<number> = input.required<number>();

  /** How many possible transfers are waiting for review. */
  readonly transferCount: InputSignal<number> = input.required<number>();

  /** Emits the tab the user picked. */
  readonly tabChange: OutputEmitterRef<ReviewTab> = output<ReviewTab>();

  /** Emits when the user opens the possible-transfers review. */
  readonly reviewTransfers: OutputEmitterRef<void> = output<void>();
}
