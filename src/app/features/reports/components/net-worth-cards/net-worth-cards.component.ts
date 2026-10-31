import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import {
  NetWorthComparison,
  NetWorthCompareMode,
  NetWorthPoint,
  NetWorthSummary,
} from '../../models/reports.model';
import { debtPaidDownText, monthsCoveredText } from '../../utils/net-worth-helpers';

const DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** A percentage to one decimal with a trailing ".0" dropped. */
const percent = (value: number): string => `${Number(Math.abs(value).toFixed(1))}%`;

/**
 * The four cards at the top of the net worth view: net worth, assets, debts and liquid cash. Each change is
 * against the comparison window's totals when comparing, otherwise against the start of the range, and is
 * always written in words with an arrow (colour is never the only cue). A debt that fell reads "paid down".
 */
@Component({
  selector: 'app-net-worth-cards',
  standalone: true,
  templateUrl: './net-worth-cards.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthCardsComponent {
  readonly summary: InputSignal<NetWorthSummary> = input.required<NetWorthSummary>();
  /** The point for the month end before the range. */
  readonly opening: InputSignal<NetWorthPoint> = input.required<NetWorthPoint>();
  readonly comparison: InputSignal<NetWorthComparison | null> =
    input.required<NetWorthComparison | null>();
  readonly compareMode: InputSignal<NetWorthCompareMode> = input.required<NetWorthCompareMode>();

  protected readonly dollars = (value: number): string => DOLLARS.format(value);

  /** What the changes are measured against, in words. */
  private readonly against: Signal<string> = computed((): string => {
    const comparison: NetWorthComparison | null = this.comparison();
    return comparison ? `vs ${comparison.label}` : 'over the range';
  });

  private readonly base: Signal<{ netWorth: number; assets: number; debts: number }> = computed(
    () => {
      const comparison: NetWorthComparison | null = this.comparison();
      return comparison ?? this.opening();
    },
  );

  protected readonly netWorthChange: Signal<string> = computed((): string => {
    const diff: number = this.summary().netWorth - this.base().netWorth;
    if (diff === 0) return `no change ${this.against()}`;
    const size: string = this.sizeOf(diff, this.base().netWorth, true);
    return `${diff > 0 ? '▲ up' : '▼ down'} ${size} ${this.against()}`;
  });

  protected readonly assetsChange: Signal<string> = computed((): string => {
    const diff: number = this.summary().assets - this.base().assets;
    if (diff === 0) return `no change ${this.against()}`;
    return `${diff > 0 ? '▲ up' : '▼ down'} ${this.sizeOf(diff, this.base().assets, false)} ${this.against()}`;
  });

  protected readonly debtsChange: Signal<string> = computed((): string => {
    const decrease: number = this.base().debts - this.summary().debts;
    if (decrease === 0) return `no change ${this.against()}`;
    const share: string = this.sizeOf(decrease, this.base().debts, false);
    return `${decrease > 0 ? '▼ down' : '▲ up'} ${share} (${debtPaidDownText(decrease)}) ${this.against()}`;
  });

  protected readonly liquidChange: Signal<string> = computed((): string =>
    monthsCoveredText(this.summary().monthsCovered),
  );

  /** "$14,120 (12.4%)" or just "8.1%", or the dollars alone when the base is zero. */
  private sizeOf(diff: number, base: number, withDollars: boolean): string {
    const dollars: string = DOLLARS.format(Math.abs(diff));
    if (base === 0) return dollars;
    const pct: string = percent((diff / base) * 100);
    return withDollars ? `${dollars} (${pct})` : pct;
  }
}
