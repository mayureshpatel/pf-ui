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
import { NetWorthGroup } from '../../models/reports.model';
import {
  ChangeTone,
  changeForGroup,
  shareOfAssets,
  sparkline,
} from '../../utils/net-worth-helpers';

const DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface GroupView {
  group: NetWorthGroup;
  balance: string;
  /** Bar width as a percentage: an asset's share of all assets, a debt's size against the largest debt. */
  width: number;
  change: { text: string; tone: ChangeTone };
  trend: string;
}

/**
 * The rows of the net worth view: account types, or the accounts of one type. Each row is a real button
 * that opens it, with a share bar (assets in the brand colour, debts in their own), the signed balance,
 * how it moved in words, and a small trend line.
 */
@Component({
  selector: 'app-net-worth-table',
  standalone: true,
  templateUrl: './net-worth-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthTableComponent {
  readonly groups: InputSignal<NetWorthGroup[]> = input.required<NetWorthGroup[]>();
  readonly groupBy: InputSignal<'TYPE' | 'ACCOUNT'> = input.required<'TYPE' | 'ACCOUNT'>();
  readonly totalAssets: InputSignal<number> = input.required<number>();
  /** What the change is against ("a year ago"), or null for the range itself. */
  readonly compareLabel: InputSignal<string | null> = input.required<string | null>();
  readonly openGroup: OutputEmitterRef<NetWorthGroup> = output<NetWorthGroup>();

  protected readonly firstHeading: Signal<string> = computed((): string =>
    this.groupBy() === 'TYPE' ? 'Account type' : 'Account',
  );
  protected readonly changeHeading: Signal<string> = computed((): string => {
    const label: string | null = this.compareLabel();
    return label ? `vs ${label}` : 'over the range';
  });

  protected readonly views: Signal<GroupView[]> = computed((): GroupView[] => {
    const largestDebt: number = Math.max(
      0,
      ...this.groups()
        .filter((g: NetWorthGroup) => g.kind === 'DEBT')
        .map((g: NetWorthGroup) => Math.abs(g.balance)),
    );
    return this.groups().map((group: NetWorthGroup): GroupView => ({
      group,
      balance: DOLLARS.format(group.balance),
      width:
        group.kind === 'DEBT'
          ? largestDebt === 0
            ? 0
            : (Math.abs(group.balance) / largestDebt) * 100
          : shareOfAssets(group, this.totalAssets()),
      change: changeForGroup(group),
      trend: sparkline(group.series),
    }));
  });

  protected toneClass(tone: ChangeTone): string {
    return tone === 'bad'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'good'
        ? 'text-primary-700 dark:text-primary-400'
        : 'text-muted-color';
  }
}
