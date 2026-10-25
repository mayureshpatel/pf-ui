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
import { Merchant } from '@models/merchant.model';
import { linksLabel, locationLabel } from '../../utils/merchant-helpers';

/**
 * The merchants as two-line rows with a pager. It renders the page it is given and owns no state:
 * selection, paging and the loading flag come in as inputs and go out as events.
 */
@Component({
  selector: 'app-merchant-list',
  standalone: true,
  templateUrl: './merchant-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantListComponent {
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();
  readonly selectedId: InputSignal<number | null> = input.required<number | null>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();
  readonly totalRecords: InputSignal<number> = input.required<number>();
  /** The zero-based page shown. */
  readonly page: InputSignal<number> = input.required<number>();
  readonly pageSize: InputSignal<number> = input.required<number>();
  /** Whether a search is active, which changes what an empty list says. */
  readonly searching: InputSignal<boolean> = input.required<boolean>();

  readonly openMerchant: OutputEmitterRef<Merchant> = output<Merchant>();
  /** Emits the zero-based page to show. */
  readonly pageChange: OutputEmitterRef<number> = output<number>();
  readonly clearSearch: OutputEmitterRef<void> = output<void>();

  readonly location: (merchant: Merchant) => string = locationLabel;

  readonly rangeText: Signal<string> = computed((): string => {
    const first: number = this.page() * this.pageSize() + 1;
    const last: number = Math.min((this.page() + 1) * this.pageSize(), this.totalRecords());
    return `${first} to ${last} of ${this.totalRecords()}`;
  });

  readonly hasPrevious: Signal<boolean> = computed((): boolean => this.page() > 0);
  readonly hasNext: Signal<boolean> = computed(
    (): boolean => (this.page() + 1) * this.pageSize() < this.totalRecords(),
  );

  links(merchant: Merchant): string {
    return linksLabel(merchant.linkCount ?? 0);
  }

  hasLinks(merchant: Merchant): boolean {
    return (merchant.linkCount ?? 0) > 0;
  }
}
