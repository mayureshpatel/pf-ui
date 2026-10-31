import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** The id of the panel the review tabs control (the list area in the page). */
export const TRANSACTIONS_TABPANEL_ID = 'transactions-tabpanel';

/** The tabs that are real list filters. */
export type ReviewTab = 'ALL' | 'NEEDS_CATEGORY';

/** The DOM id of a tab button, which the tab panel names itself by. */
export function reviewTabId(tab: ReviewTab): string {
  return tab === 'ALL' ? 'transaction-tab-all' : 'transaction-tab-needs-category';
}

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

  /** The tab buttons that exist right now, in order (Needs a category appears only when relevant). */
  readonly visibleTabs: Signal<ReviewTab[]> = computed((): ReviewTab[] =>
    this.uncategorizedCount() > 0 || this.activeTab() === 'NEEDS_CATEGORY'
      ? ['ALL', 'NEEDS_CATEGORY']
      : ['ALL'],
  );

  protected readonly tabPanelId: string = TRANSACTIONS_TABPANEL_ID;
  protected readonly tabId: (tab: ReviewTab) => string = reviewTabId;

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** Emits the tab the user picked. */
  readonly tabChange: OutputEmitterRef<ReviewTab> = output<ReviewTab>();

  /** Emits when the user opens the possible-transfers review. */
  readonly reviewTransfers: OutputEmitterRef<void> = output<void>();

  /**
   * Arrow keys, Home and End move to another tab, select it and give it focus (the tabs
   * pattern with automatic activation; there are only two tabs, so a selection is cheap).
   */
  onTabKeydown(event: KeyboardEvent): void {
    const tabs: ReviewTab[] = this.visibleTabs();
    const index: number = tabs.indexOf(this.activeTab());
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (tabs[next] === this.activeTab()) return;
    this.tabChange.emit(tabs[next]);
    this.host.nativeElement.querySelector<HTMLElement>(`#${reviewTabId(tabs[next])}`)?.focus();
  }
}
