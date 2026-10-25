import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { PageResponse } from '@models/transaction.model';
import { fromLocalDateString } from '@shared/utils/transaction.utils';
import { ExploreTransaction } from '../../models/reports.model';

/**
 * The last step of a drill-down: the transactions behind the number, a page at a time, with a link to
 * open them on the Transactions page. The host says whether that link works and, if not, why.
 */
@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './transaction-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionListComponent {
  readonly page: InputSignal<PageResponse<ExploreTransaction> | null> =
    input.required<PageResponse<ExploreTransaction> | null>();
  /** Whether the filters fit the Transactions page, and the reason when they don't. */
  readonly linkable: InputSignal<{ ok: boolean; reason?: string }> = input.required<{
    ok: boolean;
    reason?: string;
  }>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();
  /** The zero-based page to show next. */
  readonly pageChange: OutputEmitterRef<number> = output<number>();
  readonly openInTransactions: OutputEmitterRef<void> = output<void>();

  protected asDate(value: string): Date {
    return fromLocalDateString(value);
  }
}
