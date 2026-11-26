import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';

/** The Merchants page's views, as named in `?view=`. */
export type MerchantView = 'merchants' | 'unlinked' | 'rules';

export const MERCHANT_VIEWS: MerchantView[] = ['merchants', 'unlinked', 'rules'];

/** The id of a view's tab, for `aria-labelledby` on its panel. */
export const merchantTabId = (view: MerchantView): string => `merchant-tab-${view}`;

/** The panel the tabs control. */
export const MERCHANT_TAB_PANEL_ID = 'merchant-tab-panel';

/** The view a `view` query parameter names; anything unknown shows the merchants. */
export function viewFromParam(value: unknown): MerchantView {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return MERCHANT_VIEWS.includes(first as MerchantView) ? (first as MerchantView) : 'merchants';
}

/**
 * Merchants · Unlinked (N) · Rules, in the same pill tabs the Transactions page uses. The arrow
 * keys, Home and End move between tabs and choose them.
 */
@Component({
  selector: 'app-merchant-tabs',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './merchant-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantTabsComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly view: InputSignal<MerchantView> = input.required<MerchantView>();
  /** Descriptions not linked to any merchant; null until known. */
  readonly unlinkedCount: InputSignal<number | null> = input<number | null>(null);
  readonly viewChange: OutputEmitterRef<MerchantView> = output<MerchantView>();

  protected readonly tabs: { view: MerchantView; label: string }[] = [
    { view: 'merchants', label: 'Merchants' },
    { view: 'unlinked', label: 'Unlinked' },
    { view: 'rules', label: 'Rules' },
  ];
  protected readonly panelId: string = MERCHANT_TAB_PANEL_ID;
  protected readonly tabId = merchantTabId;

  protected onKeydown(event: KeyboardEvent): void {
    const current: number = MERCHANT_VIEWS.indexOf(this.view());
    const last: number = MERCHANT_VIEWS.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = current === last ? 0 : current + 1;
        break;
      case 'ArrowLeft':
        next = current === 0 ? last : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.viewChange.emit(MERCHANT_VIEWS[next]);
    this.host.nativeElement
      .querySelector<HTMLElement>(`#${merchantTabId(MERCHANT_VIEWS[next])}`)
      ?.focus();
  }
}
