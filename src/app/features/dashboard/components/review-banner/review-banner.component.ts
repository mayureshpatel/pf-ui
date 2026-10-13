import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ActionItem, ActionType } from '@models/dashboard.model';

/** Singular and plural nouns for each kind of item needing review. */
const NOUNS: Record<ActionType, { one: string; other: string }> = {
  [ActionType.TRANSFER_REVIEW]: { one: 'possible transfer', other: 'possible transfers' },
  [ActionType.UNCATEGORIZED]: { one: 'uncategorized expense', other: 'uncategorized expenses' },
  [ActionType.STALE_DATA]: { one: 'account with stale data', other: 'accounts with stale data' },
};

/** A banner entry: the source item and its display text. */
interface BannerEntry {
  item: ActionItem;
  label: string;
}

/**
 * A strip of shortcuts to data that needs the user's attention (possible transfers,
 * uncategorized expenses). Shows nothing when there is nothing to review.
 */
@Component({
  selector: 'app-review-banner',
  standalone: true,
  templateUrl: './review-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewBannerComponent {
  private readonly router: Router = inject(Router);

  /** The items needing review. */
  readonly items: InputSignal<ActionItem[]> = input.required<ActionItem[]>();

  /** Items paired with their display text. */
  readonly entries: Signal<BannerEntry[]> = computed((): BannerEntry[] =>
    this.items().map((item: ActionItem): BannerEntry => ({ item, label: this.labelFor(item) })),
  );

  /**
   * Navigates to the page that resolves an item. Items without a route are not navigable.
   *
   * @param item - The clicked item.
   */
  open(item: ActionItem): void {
    if (item.route) {
      void this.router.navigateByUrl(item.route);
    }
  }

  private labelFor(item: ActionItem): string {
    if (item.count <= 0) {
      return item.message;
    }
    const noun: { one: string; other: string } = NOUNS[item.type];
    return `${item.count.toLocaleString('en-US')} ${item.count === 1 ? noun.one : noun.other}`;
  }
}
