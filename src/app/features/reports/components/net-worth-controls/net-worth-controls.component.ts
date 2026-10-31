import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Account, AccountType } from '@models/account.model';
import { NetWorthCompareMode, NetWorthMeasure } from '../../models/reports.model';
import { RangePreset, rangePresets } from '../../utils/explore-helpers';
import { NetWorthState } from '../../utils/net-worth-state';

const CUSTOM = 'custom';
const MEASURE_OPTIONS: { value: NetWorthMeasure; label: string }[] = [
  { value: 'NET_WORTH', label: 'Net worth' },
  { value: 'ASSETS', label: 'Assets' },
  { value: 'DEBTS', label: 'Debts' },
];
const COMPARE_OPTIONS: { value: NetWorthCompareMode; label: string }[] = [
  { value: 'NONE', label: 'No comparison' },
  { value: 'YEAR_AGO', label: 'A year ago' },
  { value: 'PREVIOUS_PERIOD', label: 'Previous period' },
];

/**
 * The net worth view's controls: the measure, the date range, the comparison, and the filters (limited to
 * accounts and account type; the filters that do not apply to balances are shown disabled with the reason).
 * Nothing is stored here; every choice is emitted as a partial state for the container to merge.
 */
@Component({
  selector: 'app-net-worth-controls',
  standalone: true,
  imports: [FormsModule, SelectModule],
  templateUrl: './net-worth-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthControlsComponent {
  readonly state: InputSignal<NetWorthState> = input.required<NetWorthState>();
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();
  readonly types: InputSignal<AccountType[]> = input.required<AccountType[]>();
  /** A change to merge into the state (named so it is not mistaken for a DOM `change` event). */
  readonly stateChange: OutputEmitterRef<Partial<NetWorthState>> = output<Partial<NetWorthState>>();

  protected readonly measures = MEASURE_OPTIONS;
  protected readonly compareOptions = COMPARE_OPTIONS;
  private readonly presets: RangePreset[] = rangePresets();
  protected readonly rangeOptions: { value: string; label: string }[] = [
    ...this.presets.map((p: RangePreset) => ({ value: p.key, label: p.label })),
    { value: CUSTOM, label: 'Custom range' },
  ];
  protected readonly draftStart: WritableSignal<string> = signal('');
  protected readonly draftEnd: WritableSignal<string> = signal('');
  private readonly customOpen: WritableSignal<boolean> = signal(false);

  /** The range select's value: a preset when the dates match one, else the custom range. */
  protected readonly rangeKey: Signal<string> = computed((): string => {
    if (this.customOpen()) return CUSTOM;
    const state: NetWorthState = this.state();
    const match: RangePreset | undefined = this.presets.find(
      (p: RangePreset) =>
        p.label === state.rangeLabel &&
        p.startDate === state.startDate &&
        p.endDate === state.endDate,
    );
    return match ? match.key : CUSTOM;
  });

  /** The accounts shown as filter chips. */
  protected readonly chosenAccounts: Signal<Account[]> = computed((): Account[] =>
    this.state()
      .accountIds.map((id: number) => this.accounts().find((a: Account) => a.id === id))
      .filter((a: Account | undefined): a is Account => a !== undefined),
  );
  /** Accounts that can still be added to the filter. */
  protected readonly otherAccounts: Signal<Account[]> = computed((): Account[] =>
    this.accounts().filter((a: Account) => !this.state().accountIds.includes(a.id)),
  );
  protected readonly typeLabel: Signal<string | null> = computed((): string | null => {
    const code: string | null = this.state().typeCode;
    if (code === null) return null;
    return this.types().find((t: AccountType) => t.code === code)?.label ?? code;
  });
  protected readonly disabledFilters: string[] = ['Category', 'Merchant', 'Tag'];

  protected onMeasure(measure: NetWorthMeasure): void {
    this.stateChange.emit({ measure });
  }

  protected onCompare(compare: NetWorthCompareMode): void {
    this.stateChange.emit({ compare });
  }

  protected onRange(key: string): void {
    if (key === CUSTOM) {
      this.draftStart.set(this.state().startDate);
      this.draftEnd.set(this.state().endDate);
      this.customOpen.set(true);
      return;
    }
    this.customOpen.set(false);
    const preset: RangePreset | undefined = this.presets.find((p: RangePreset) => p.key === key);
    if (preset) {
      this.stateChange.emit({
        startDate: preset.startDate,
        endDate: preset.endDate,
        rangeLabel: preset.label,
        month: null,
      });
    }
  }

  /** Applies a typed custom range when both dates are there and in order. */
  protected applyCustom(): void {
    const start: string = this.draftStart();
    const end: string = this.draftEnd();
    if (!start || !end || start > end) return;
    this.customOpen.set(false);
    this.stateChange.emit({ startDate: start, endDate: end, rangeLabel: 'Custom', month: null });
  }

  protected onAddAccount(id: number | null): void {
    if (id === null) return;
    this.stateChange.emit({ accountIds: [...this.state().accountIds, id] });
  }

  protected removeAccount(id: number): void {
    const state: NetWorthState = this.state();
    this.stateChange.emit({
      accountIds: state.accountIds.filter((other: number) => other !== id),
      accountId: state.accountId === id ? null : state.accountId,
    });
  }

  protected removeType(): void {
    this.stateChange.emit({ typeCode: null, accountId: null });
  }
}
