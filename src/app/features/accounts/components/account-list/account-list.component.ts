import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  viewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';
import { Account } from '@models/account.model';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { AccountGroup, bankLabel } from '../../utils/account-totals';

/**
 * The accounts in two groups (Assets, Liabilities). A row opens the account's summary; a separate
 * menu button offers the shortcuts. It renders what it is given and owns no data.
 */
@Component({
  selector: 'app-account-list',
  standalone: true,
  imports: [MenuModule, FormatCurrencyPipe],
  templateUrl: './account-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountListComponent {
  readonly groups: InputSignal<AccountGroup[]> = input.required<AccountGroup[]>();
  readonly selectedId: InputSignal<number | null> = input.required<number | null>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();

  readonly openAccount: OutputEmitterRef<Account> = output<Account>();
  readonly viewTransactions: OutputEmitterRef<Account> = output<Account>();
  readonly reconcileAccount: OutputEmitterRef<Account> = output<Account>();
  readonly editAccount: OutputEmitterRef<Account> = output<Account>();
  readonly deleteAccount: OutputEmitterRef<Account> = output<Account>();

  private readonly menu = viewChild<Menu>('menu');

  /** The items of the popup menu for the account whose menu button was last used. */
  menuModel: MenuItem[] = [];

  readonly bankLabel = bankLabel;

  /** The four shortcuts for one account, in display order. */
  menuItemsFor(account: Account): MenuItem[] {
    return [
      {
        label: 'View transactions',
        icon: 'pi pi-list',
        command: (): void => this.viewTransactions.emit(account),
      },
      {
        label: 'Reconcile',
        icon: 'pi pi-sync',
        command: (): void => this.reconcileAccount.emit(account),
      },
      { label: 'Edit', icon: 'pi pi-pencil', command: (): void => this.editAccount.emit(account) },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: (): void => this.deleteAccount.emit(account),
      },
    ];
  }

  /** Opens the popup menu next to the button that was used. */
  toggleMenu(event: Event, account: Account): void {
    event.stopPropagation();
    this.menuModel = this.menuItemsFor(account);
    this.menu()?.toggle(event);
  }
}
