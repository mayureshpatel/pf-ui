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
import { merchantCountLabel, unlinkedLabel } from '../../utils/merchant-helpers';

/** The panel's default mode: how many merchants there are, how much is still unlinked, and the two actions. */
@Component({
  selector: 'app-merchant-overview',
  standalone: true,
  templateUrl: './merchant-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantOverviewComponent {
  readonly merchantCount: InputSignal<number> = input.required<number>();
  /** Descriptions with no merchant link, or null while that figure is still loading. */
  readonly unlinkedCount: InputSignal<number | null> = input.required<number | null>();
  readonly hasTransactions: InputSignal<boolean> = input.required<boolean>();
  /** The description totals could not be loaded (so the figure above will not arrive). */
  readonly statsFailed: InputSignal<boolean> = input<boolean>(false);

  readonly add: OutputEmitterRef<void> = output<void>();
  readonly linkDescriptions: OutputEmitterRef<void> = output<void>();
  /** Asks the page to load the description totals again. */
  readonly retryStats: OutputEmitterRef<void> = output<void>();

  readonly merchantsText: Signal<string> = computed((): string =>
    merchantCountLabel(this.merchantCount()),
  );
  readonly unlinkedText: Signal<string | null> = computed((): string | null => {
    const count: number | null = this.unlinkedCount();
    return count === null ? null : unlinkedLabel(count);
  });
  readonly showCreateHint: Signal<boolean> = computed(
    (): boolean => this.merchantCount() === 0 && this.hasTransactions(),
  );
  readonly canLink: Signal<boolean> = computed(
    (): boolean => this.merchantCount() > 0 && (this.unlinkedCount() ?? 0) > 0,
  );
}
