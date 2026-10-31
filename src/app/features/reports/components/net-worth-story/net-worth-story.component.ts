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
import { Params } from '@angular/router';
import { NetWorthGroup, NetWorthStory } from '../../models/reports.model';
import { accountExplorerQuery } from '../../utils/net-worth-helpers';
import { NetWorthState } from '../../utils/net-worth-state';

const DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * One account's story over the range: what it held, what went in and out, and the interest and
 * adjustments, with links to its transactions in the explorer and to its panel in Accounts.
 */
@Component({
  selector: 'app-net-worth-story',
  standalone: true,
  templateUrl: './net-worth-story.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthStoryComponent {
  readonly group: InputSignal<NetWorthGroup> = input.required<NetWorthGroup>();
  readonly state: InputSignal<NetWorthState> = input.required<NetWorthState>();
  /** The explorer URL parameters for this account. */
  readonly openExplorer: OutputEmitterRef<Params> = output<Params>();
  /** The account's id, for the Accounts page. */
  readonly openAccounts: OutputEmitterRef<number> = output<number>();

  protected readonly dollars = (value: number): string => DOLLARS.format(value);

  protected readonly story: Signal<NetWorthStory | null> = computed(
    (): NetWorthStory | null => this.group().story,
  );

  protected readonly quiet: Signal<boolean> = computed((): boolean => {
    const story: NetWorthStory | null = this.story();
    return (
      !!story &&
      story.deposits === 0 &&
      story.withdrawals === 0 &&
      story.interestAndAdjustments === 0
    );
  });

  protected readonly signed: Signal<string> = computed((): string => {
    const value: number = this.story()?.interestAndAdjustments ?? 0;
    return `${value < 0 ? '-' : '+'}${DOLLARS.format(Math.abs(value))}`;
  });

  protected onExplorer(): void {
    this.openExplorer.emit(accountExplorerQuery(this.group(), this.state()));
  }

  protected onAccounts(): void {
    this.openAccounts.emit(Number(this.group().key));
  }
}
