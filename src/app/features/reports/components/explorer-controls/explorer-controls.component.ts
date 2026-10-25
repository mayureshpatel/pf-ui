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
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Compare, ExploreState, GroupBy, Measure, Side } from '../../models/reports.model';
import {
  applyStartView,
  COMPARE_LABELS,
  GROUP_LABELS,
  isAllowed,
  MEASURE_LABELS,
  RangePreset,
  rangePresets,
  StartView,
  startViews,
} from '../../utils/explore-helpers';
import { COMPARES, GROUP_BYS, MEASURES } from '../../utils/explore-state';

interface GroupByOption {
  value: GroupBy;
  label: string;
  disabled: boolean;
  reason: string | null;
}

const CUSTOM = 'custom';

/**
 * The explorer's controls: what to measure, how to group it, the date range, the comparison and the
 * "start from" shortcuts. Nothing is stored here; every choice is emitted as a partial state for the
 * host to merge. A measure that rules out the current grouping switches it to Month, and says so.
 */
@Component({
  selector: 'app-explorer-controls',
  standalone: true,
  imports: [FormsModule, InputTextModule, SelectModule],
  templateUrl: './explorer-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorerControlsComponent {
  readonly state: InputSignal<ExploreState> = input.required<ExploreState>();
  /** A change to merge into the state (named so it is not mistaken for a DOM `change` event). */
  readonly stateChange: OutputEmitterRef<Partial<ExploreState>> = output<Partial<ExploreState>>();

  protected readonly measures: Measure[] = MEASURES;
  protected readonly sides: Side[] = ['SPENDING', 'INCOME'];
  protected readonly measureLabels: Record<Measure, string> = MEASURE_LABELS;
  protected readonly startViews: StartView[] = startViews;
  protected readonly compareOptions: { value: Compare; label: string }[] = COMPARES.map(
    (value: Compare) => ({ value, label: COMPARE_LABELS[value] }),
  );

  private readonly presets: RangePreset[] = rangePresets();
  protected readonly rangeOptions: { value: string; label: string }[] = [
    ...this.presets.map((p: RangePreset) => ({ value: p.key, label: p.label })),
    { value: CUSTOM, label: 'Custom range' },
  ];

  protected readonly note: WritableSignal<string | null> = signal(null);
  private readonly customOpen: WritableSignal<boolean> = signal(false);
  protected readonly draftStart: WritableSignal<string> = signal('');
  protected readonly draftEnd: WritableSignal<string> = signal('');

  /** The range select's value: a preset when the dates match one, else the custom range. */
  protected readonly rangeKey: Signal<string> = computed((): string => {
    if (this.customOpen()) return CUSTOM;
    const state: ExploreState = this.state();
    const match: RangePreset | undefined = this.presets.find(
      (p: RangePreset) =>
        p.label === state.rangeLabel &&
        p.startDate === state.startDate &&
        p.endDate === state.endDate,
    );
    return match ? match.key : CUSTOM;
  });

  protected readonly groupByOptions: Signal<GroupByOption[]> = computed((): GroupByOption[] => {
    const state: ExploreState = this.state();
    const subcategoryAvailable: boolean =
      state.filters.categoryId !== undefined || state.groupBy === 'SUBCATEGORY';
    return GROUP_BYS.filter((g: GroupBy) => g !== 'SUBCATEGORY' || subcategoryAvailable).map(
      (value: GroupBy): GroupByOption => {
        const allowed = isAllowed(state.measure, value);
        return {
          value,
          label: GROUP_LABELS[value],
          disabled: !allowed.ok,
          reason: allowed.reason ?? null,
        };
      },
    );
  });

  /** The reason the disabled groupings are disabled, for the select's description. */
  protected readonly groupByHint: Signal<string | null> = computed(
    (): string | null =>
      this.groupByOptions().find((o: GroupByOption) => o.disabled)?.reason ?? null,
  );

  protected onMeasure(measure: Measure): void {
    if (isAllowed(measure, this.state().groupBy).ok) {
      this.note.set(null);
      this.stateChange.emit({ measure });
      return;
    }
    this.note.set(
      `${MEASURE_LABELS[measure]} only makes sense over time, so the grouping switched to Month.`,
    );
    this.stateChange.emit({ measure, groupBy: 'MONTH' });
  }

  protected onSide(side: Side): void {
    this.note.set(null);
    this.stateChange.emit({ side });
  }

  protected onGroupBy(groupBy: GroupBy): void {
    this.note.set(null);
    this.stateChange.emit({ groupBy, leaf: false });
  }

  protected onCompare(compare: Compare): void {
    this.note.set(null);
    this.stateChange.emit({ compare });
  }

  protected onRange(key: string): void {
    this.note.set(null);
    if (key === CUSTOM) {
      this.draftStart.set(this.state().startDate);
      this.draftEnd.set(this.state().endDate);
      this.customOpen.set(true);
      return;
    }
    const preset: RangePreset | undefined = this.presets.find((p: RangePreset) => p.key === key);
    if (!preset) return;
    this.customOpen.set(false);
    this.stateChange.emit({
      startDate: preset.startDate,
      endDate: preset.endDate,
      rangeLabel: preset.label,
    });
  }

  protected onDate(which: 'start' | 'end', value: string): void {
    (which === 'start' ? this.draftStart : this.draftEnd).set(value);
    const start: string = this.draftStart();
    const end: string = this.draftEnd();
    if (start && end && start <= end) {
      this.stateChange.emit({ startDate: start, endDate: end, rangeLabel: 'Custom' });
    }
  }

  protected onStartView(view: StartView): void {
    this.note.set(null);
    this.customOpen.set(false);
    this.stateChange.emit(applyStartView(this.state(), view));
  }
}
