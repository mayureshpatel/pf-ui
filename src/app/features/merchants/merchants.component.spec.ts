import { vi, Mock, Mocked } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';

import { MerchantsComponent } from './merchants.component';
import { MerchantApiService } from './services/merchant-api.service';
import { MerchantEditFormComponent } from './components/merchant-edit-form/merchant-edit-form.component';
import { UnlinkedGroupsComponent } from './components/unlinked-groups/unlinked-groups.component';
import { MerchantRulesComponent } from '@features/settings/merchant-rules/merchant-rules.component';
import { SettingsGuard } from '@features/settings/settings.guard';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import {
  DescriptionGroup,
  DescriptionLinkResult,
  LookAlikeWarning,
  Merchant,
  MerchantDescriptionLink,
  TransactionDescription,
} from '@models/merchant.model';

const LINK_RESULT: DescriptionLinkResult = {
  merchantId: 1,
  linkedCount: 1,
  movedCount: 0,
  transactionsFilled: 0,
  linkChanges: [],
  filledTransactionIds: [],
};

const merchant = (id: number, name: string, over: Partial<Merchant> = {}): Merchant => ({
  id,
  userId: 1,
  name,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  linkCount: 0,
  ...over,
});
const amazon = merchant(1, 'Amazon', { city: 'Seattle', state: 'WA', linkCount: 2 });
const costco = merchant(2, 'Costco', { linkCount: 1 });
const shell = merchant(3, 'Shell');
const list = [amazon, costco, shell];
const links: MerchantDescriptionLink[] = [
  { id: 10, merchantId: 1, description: 'AMZN MKTP' },
  { id: 11, merchantId: 1, description: 'AMAZON.COM' },
];
const row = (description: string, merchantId: number | null = null): TransactionDescription => ({
  description,
  transactionCount: 3,
  merchantId,
  merchantName: merchantId === null ? null : 'Someone',
});
const group = (name: string, variants: string[] = [name]): DescriptionGroup => ({
  key: name.toLowerCase(),
  displayName: name,
  variantCount: variants.length,
  transactionCount: 3 * variants.length,
  variants: variants.map((v) => row(v)),
  similarKeys: [],
});
const page = <T>(content: T[], total = content.length) => ({
  content,
  page: { totalElements: total, totalPages: 1, number: 0, size: 20 },
});

@Component({
  selector: 'app-merchant-rules',
  standalone: true,
  template: '<p>merchant rules section</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MerchantRulesStubComponent {}

describe('MerchantsComponent', () => {
  let component: MerchantsComponent;
  let fixture: ComponentFixture<MerchantsComponent>;
  let mockApi: Mocked<
    Pick<
      MerchantApiService,
      | 'getMerchants'
      | 'createMerchant'
      | 'updateMerchant'
      | 'deleteMerchant'
      | 'getDescriptionLinks'
      | 'addDescriptionLink'
      | 'addDescriptionLinks'
      | 'deleteDescriptionLink'
      | 'suggestMerchants'
      | 'checkDescriptionLinks'
      | 'undoDescriptionLinks'
    >
  >;
  let mockTransactions: Mocked<
    Pick<TransactionApiService, 'getDescriptions' | 'getDescriptionGroups'>
  >;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmation: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: Mocked<Pick<Router, 'navigate'>>;
  let queryParams: BehaviorSubject<Params>;
  /** The `?view=` the page opens with. */
  let startParams: Params = {};

  const confirmAccept = (index = 0): void =>
    mockConfirmation.confirm.mock.calls[index][0].accept!();
  const dirtyForm = (): void => {
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(MerchantEditFormComponent))
      .componentInstance as MerchantEditFormComponent;
    form.form.markAsDirty();
  };
  const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');

  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    mockApi = {
      getMerchants: vi.fn().mockReturnValue(of(page(list, 312))),
      createMerchant: vi.fn().mockReturnValue(of(99)),
      updateMerchant: vi.fn().mockReturnValue(of(1)),
      deleteMerchant: vi.fn().mockReturnValue(of(undefined)),
      getDescriptionLinks: vi.fn().mockReturnValue(of(links)),
      addDescriptionLink: vi.fn().mockReturnValue(of(LINK_RESULT)),
      addDescriptionLinks: vi.fn().mockReturnValue(of(LINK_RESULT)),
      deleteDescriptionLink: vi.fn().mockReturnValue(of(undefined)),
      suggestMerchants: vi.fn().mockReturnValue(of([])),
      checkDescriptionLinks: vi.fn().mockReturnValue(of({ merchantId: 1, warnings: [] })),
      undoDescriptionLinks: vi.fn().mockReturnValue(
        of({
          linksRestored: 1,
          linksSkipped: 0,
          transactionsRestored: 0,
          skippedTransactionIds: [],
        }),
      ),
    };
    mockTransactions = {
      getDescriptions: vi
        .fn()
        .mockImplementation((p: { unlinkedOnly?: boolean; size: number }) =>
          p.size === 1
            ? of(page([], p.unlinkedOnly ? 47 : 100))
            : of(page([row('AMZN MKTP'), row('COSTCO #12', 2)], 2)),
        ),
      getDescriptionGroups: vi.fn().mockReturnValue(
        of({
          content: [
            {
              key: 'kroger fuel ctr',
              displayName: 'KROGER FUEL CTR',
              variantCount: 1,
              transactionCount: 3,
              variants: [row('KROGER FUEL CTR #1')],
              similarKeys: [],
            },
          ],
          page: { totalElements: 1, totalPages: 1, number: 0, size: 25 },
          unlinkedDescriptionCount: 45,
        }),
      ),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmation = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };
    // the test browser has no matchMedia (PF-989); these specs describe the desktop layout
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: (): void => undefined,
        removeEventListener: (): void => undefined,
      }),
    );
    queryParams = new BehaviorSubject<Params>(startParams);

    await TestBed.configureTestingModule({
      imports: [MerchantsComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockApi },
        { provide: TransactionApiService, useValue: mockTransactions },
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmation },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams,
            get snapshot() {
              return { queryParams: startParams };
            },
          },
        },
      ],
    })
      .overrideComponent(MerchantsComponent, {
        remove: { imports: [MerchantRulesComponent] },
        add: { imports: [MerchantRulesStubComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MerchantsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('loading', () => {
    it('should open on the overview with the merchant total and the unlinked figure', () => {
      // assert & verify
      expect(component.mode()).toBe('overview');
      expect(component.merchants().map((m) => m.name)).toEqual(['Amazon', 'Costco', 'Shell']);
      expect(component.totalRecords()).toBe(312);
      expect(component.unlinkedCount()).toBe(47);
      expect(component.hasTransactions()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('312 merchants');
    });

    it('should show the error page when the very first load fails', () => {
      // arrange
      component.loadedOnce.set(false);
      mockApi.getMerchants.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadMerchants();
      fixture.detectChanges();

      // assert & verify
      expect(component.merchants()).toEqual([]);
      expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
    });

    // PF-963: a failed search or page keeps the screen, the search box and the overview
    it('should keep the search box and show an inline retry when a later load fails', () => {
      // arrange
      mockApi.getMerchants.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.onSearchInput('amz');
      vi.useFakeTimers();
      vi.advanceTimersByTime(300);
      vi.useRealTimers();
      component.loadMerchants();
      fixture.detectChanges();

      // assert & verify
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('app-page-error-state')).toBeNull();
      expect(el.querySelector('input[aria-label="Search merchants"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="list-error"]')?.getAttribute('role')).toBe('alert');
      expect(el.querySelector('app-merchant-overview')).not.toBeNull();
    });

    it('should reload and focus the search box when Retry is pressed', () => {
      // arrange
      mockApi.getMerchants.mockReturnValue(throwError(() => new Error('down')));
      component.loadMerchants();
      fixture.detectChanges();
      mockApi.getMerchants.mockClear();
      mockApi.getMerchants.mockReturnValue(of(page([amazon], 1)));

      // act
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('[data-testid="list-retry"]')
        ?.click();
      fixture.detectChanges();

      // assert & verify
      expect(mockApi.getMerchants).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(
        fixture.nativeElement.querySelector('input[aria-label="Search merchants"]'),
      );
    });

    it('should drop a slower response from an earlier load', () => {
      // arrange
      const pending: Subject<ReturnType<typeof page<Merchant>>>[] = [];
      mockApi.getMerchants.mockImplementation(() => {
        const request = new Subject<ReturnType<typeof page<Merchant>>>();
        pending.push(request);
        return request;
      });

      // act
      component.loadMerchants();
      component.loadMerchants();
      pending[1].next(page([shell]));
      pending[0].next(page([amazon]));

      // assert & verify
      expect(component.merchants().map((m) => m.name)).toEqual(['Shell']);
    });

    it('should keep the same panel element mounted across a reload', () => {
      // arrange
      const panel = fixture.nativeElement.querySelector('app-side-panel');

      // act
      component.loadMerchants();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBe(panel);
    });
  });

  describe('search and paging', () => {
    it('should debounce the search, return to page 1 and pass the term to the api', () => {
      // arrange
      vi.useFakeTimers();
      component.setPage(2);
      mockApi.getMerchants.mockClear();

      // act
      component.onSearchInput('co');
      component.onSearchInput('cost');
      vi.advanceTimersByTime(300);

      // assert & verify
      expect(mockApi.getMerchants).toHaveBeenCalledTimes(1);
      expect(mockApi.getMerchants).toHaveBeenCalledWith('cost', { page: 0, size: 20 });
      vi.useRealTimers();
    });

    it('should change page and leave the panel as it is', () => {
      // arrange
      component.openMerchant(amazon);
      mockApi.getMerchants.mockClear();

      // act
      component.setPage(1);

      // assert & verify
      expect(mockApi.getMerchants).toHaveBeenCalledWith(null, { page: 1, size: 20 });
      expect(component.mode()).toBe('merchant');
      expect(component.selected()?.id).toBe(1);
    });

    it('should clear the search and reload from page 1', () => {
      // arrange
      component.searchTerm.set('zzz');
      mockApi.getMerchants.mockClear();

      // act
      component.clearSearch();

      // assert & verify
      expect(component.searchTerm()).toBe('');
      expect(mockApi.getMerchants).toHaveBeenCalledWith(null, { page: 0, size: 20 });
    });
  });

  describe('after the review', () => {
    it('should not drop into add mode, or lose unsaved edits, when a search with no matches is cleared', () => {
      // arrange
      vi.useFakeTimers();
      component.openMerchant(amazon);
      dirtyForm();
      mockApi.getMerchants.mockReturnValue(of(page<Merchant>([], 0)));
      component.onSearchInput('zzz');
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // act -- clear the box before the reload for the empty search comes back
      component.onSearchInput('');
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('merchant');
      expect(
        fixture.nativeElement.querySelector('input[aria-label="Search merchants"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('No merchants yet');
      vi.useRealTimers();
    });

    it('should leave the panel alone when a link batch finishes after the user has moved on', () => {
      // arrange
      const pending = new Subject<DescriptionLinkResult>();
      mockApi.addDescriptionLinks.mockReturnValue(pending);
      component.openMerchant(amazon);
      component.openPicker(amazon, false);
      component.onLink(['A']);
      component.back();
      component.back();
      component.openMerchant(costco);

      // act
      pending.next(LINK_RESULT);
      pending.complete();

      // assert & verify -- the status line stays with Amazon, not on Costco's panel
      expect(component.lastLink()?.merchantId).toBe(1);
      expect(component.shownLastLink()).toBeNull();
      expect(component.mode()).toBe('merchant');
      expect(component.selected()?.id).toBe(2);
    });

    it('should not open the picker for a merchant created after the user pressed Back', () => {
      // arrange
      const pending = new Subject<number>();
      mockApi.createMerchant.mockReturnValue(pending);
      component.startAdd();
      component.saveMerchant({ name: 'Target' });
      component.back();

      // act
      pending.next(99);
      pending.complete();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Merchant added');
      expect(component.mode()).toBe('overview');
      expect(component.selected()).toBeNull();
    });
  });

  describe('panel modes', () => {
    it('should open a merchant, load its links, and return on Back, Close and Escape', () => {
      // act
      component.openMerchant(amazon);
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('merchant');
      expect(mockApi.getDescriptionLinks).toHaveBeenCalledWith(1);
      expect(component.links()).toEqual(links);

      // act & assert
      component.back();
      expect(component.mode()).toBe('overview');
      component.openMerchant(amazon);
      component.onPanelClose();
      expect(component.mode()).toBe('overview');
      component.openMerchant(amazon);
      aside().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(component.mode()).toBe('overview');
    });

    it('should ask to discard unsaved changes before every move away', () => {
      // arrange
      component.openMerchant(amazon);
      dirtyForm();

      // act & assert -- another row
      component.openMerchant(costco);
      expect(mockConfirmation.confirm).toHaveBeenCalledTimes(1);
      expect(component.selected()?.id).toBe(1);

      // act & assert -- Back, Close, Add
      component.back();
      component.onPanelClose();
      component.startAdd();
      expect(mockConfirmation.confirm).toHaveBeenCalledTimes(4);
      expect(component.mode()).toBe('merchant');
      expect(mockConfirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');

      // act -- confirm the last one
      confirmAccept(3);
      expect(component.mode()).toBe('add');
    });

    it('should add a merchant, open it, then open the picker for it', () => {
      // arrange
      component.startAdd();
      fixture.detectChanges();

      // act
      component.saveMerchant({ name: 'Target', city: 'Austin' });

      // assert & verify
      expect(mockApi.createMerchant).toHaveBeenCalledWith({
        userId: 1,
        name: 'Target',
        city: 'Austin',
      });
      expect(mockToast.success).toHaveBeenCalledWith('Merchant added');
      expect(component.selected()?.id).toBe(99);
      expect(component.mode()).toBe('picker');
      expect(component.pickerTarget()?.id).toBe(99);
      expect(mockTransactions.getDescriptionGroups).toHaveBeenCalledWith(
        expect.objectContaining({ unlinkedOnly: true, page: 0, size: 25 }),
      );
    });

    it('should save changes with the user id and mark the form pristine', () => {
      // arrange
      component.openMerchant(amazon);
      dirtyForm();
      // the server returns the saved name when the list reloads
      mockApi.getMerchants.mockReturnValue(
        of(page([{ ...amazon, name: 'Amazon Prime' }, costco, shell], 312)),
      );

      // act
      component.saveMerchant({ id: 1, name: 'Amazon Prime', city: 'Seattle' });
      fixture.detectChanges();

      // assert & verify
      expect(mockApi.updateMerchant).toHaveBeenCalledWith({
        id: 1,
        userId: 1,
        name: 'Amazon Prime',
        city: 'Seattle',
      });
      expect(mockToast.success).toHaveBeenCalledWith('Merchant updated');
      expect(component.selected()?.name).toBe('Amazon Prime');
      const form = fixture.debugElement.query(By.directive(MerchantEditFormComponent))
        .componentInstance as MerchantEditFormComponent;
      expect(form.form.dirty).toBe(false);
    });

    it('should block a second save while one is in flight', () => {
      // arrange
      mockApi.updateMerchant.mockReturnValue(new Subject<number>());
      component.openMerchant(amazon);

      // act
      component.saveMerchant({ id: 1, name: 'A' });
      component.saveMerchant({ id: 1, name: 'B' });

      // assert & verify
      expect(mockApi.updateMerchant).toHaveBeenCalledTimes(1);
    });

    // PF-883
    it('should block a delete while a save is in flight', () => {
      // arrange
      mockApi.updateMerchant.mockReturnValue(new Subject<number>());
      component.openMerchant(amazon);
      component.saveMerchant({ id: 1, name: 'A' });

      // act
      component.deleteMerchant();

      // assert & verify
      expect(mockConfirmation.confirm).not.toHaveBeenCalled();
      expect(mockApi.deleteMerchant).not.toHaveBeenCalled();
    });

    it('should not mark another merchant pristine or merge a finished save into it', () => {
      // arrange -- save Amazon, then (discarding its edits) open Costco before the save returns
      const saved = new Subject<number>();
      mockApi.updateMerchant.mockReturnValue(saved);
      component.openMerchant(amazon);
      dirtyForm();
      component.saveMerchant({ id: 1, name: 'Amazon Renamed' });
      component.openMerchant(costco);
      confirmAccept();
      dirtyForm();
      const costcoForm = fixture.debugElement.query(By.directive(MerchantEditFormComponent))
        .componentInstance as MerchantEditFormComponent;

      // act
      saved.next(1);
      saved.complete();
      fixture.detectChanges();

      // assert & verify
      expect(component.selected()?.id).toBe(2);
      expect(component.selected()?.name).toBe('Costco');
      expect(costcoForm.form.dirty).toBe(true);
    });

    it('should delete after confirmation and return to the overview', () => {
      // arrange
      component.openMerchant(amazon);

      // act
      component.deleteMerchant();
      expect(mockConfirmation.confirm.mock.calls[0][0].message).toContain('Amazon');
      confirmAccept();

      // assert & verify
      expect(mockApi.deleteMerchant).toHaveBeenCalledWith(1);
      expect(mockToast.success).toHaveBeenCalledWith('Merchant deleted');
      expect(component.mode()).toBe('overview');
    });

    it('should toast the server message and stay when a delete fails', () => {
      // arrange
      mockApi.deleteMerchant.mockReturnValue(
        throwError(() => ({ error: { detail: 'Merchant is in use.' } })),
      );
      component.openMerchant(amazon);

      // act
      component.deleteMerchant();
      confirmAccept();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Merchant is in use.');
      expect(component.mode()).toBe('merchant');
    });

    it('should return to the overview with a toast when the shown merchant no longer exists', () => {
      // arrange
      mockApi.getDescriptionLinks.mockReturnValue(throwError(() => ({ status: 404 })));

      // act
      component.openMerchant(amazon);

      // assert & verify
      expect(component.mode()).toBe('overview');
      expect(mockToast.error).toHaveBeenCalledWith('That merchant no longer exists.');
    });

    it('should remove a link, toast, and refresh the links, the list and the unlinked figure', () => {
      // arrange
      component.openMerchant(amazon);
      mockApi.getMerchants.mockClear();
      mockApi.getDescriptionLinks.mockClear();
      mockTransactions.getDescriptions.mockClear();

      // act
      component.removeLink(links[0]);

      // assert & verify
      expect(mockApi.deleteDescriptionLink).toHaveBeenCalledWith(1, 10);
      expect(mockToast.success).toHaveBeenCalledWith('Link removed');
      expect(mockApi.getDescriptionLinks).toHaveBeenCalledWith(1);
      expect(mockApi.getMerchants).toHaveBeenCalled();
      expect(mockTransactions.getDescriptions).toHaveBeenCalledWith(
        expect.objectContaining({ unlinkedOnly: true, size: 1 }),
      );
    });

    it('should include period=all in View transactions', () => {
      // arrange
      component.openMerchant(amazon);

      // act
      component.viewTransactions();

      // assert & verify
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions'], {
        queryParams: { merchant: 'Amazon', period: 'all' },
      });
    });

    it('should open add mode with no Back or Close when there are no merchants', () => {
      // arrange
      mockApi.getMerchants.mockReturnValue(of(page<Merchant>([], 0)));

      // act
      component.loadMerchants();
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('add');
      expect(component.onlyAddMode()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('No merchants yet');
    });
  });

  // PF-883
  describe('stale responses and totals', () => {
    it("should not reload the first merchant's links when the user opened another before the remove returned", () => {
      // arrange
      const removed = new Subject<void>();
      mockApi.deleteDescriptionLink.mockReturnValue(removed);
      component.openMerchant(amazon);
      component.removeLink(links[0]);
      component.openMerchant(costco);
      mockApi.getDescriptionLinks.mockClear();

      // act
      removed.next();
      removed.complete();

      // assert & verify -- Costco is shown, so Amazon's links are not fetched (or shown)
      expect(mockApi.getDescriptionLinks).not.toHaveBeenCalled();
    });

    it('should still reload the links when the same merchant is still shown', () => {
      // arrange
      component.openMerchant(amazon);
      mockApi.getDescriptionLinks.mockClear();

      // act
      component.removeLink(links[0]);

      // assert & verify
      expect(mockApi.getDescriptionLinks).toHaveBeenCalledWith(1);
    });

    it('should flag a failed totals load so the overview can offer a retry', () => {
      // arrange
      mockTransactions.getDescriptions.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadStats();

      // assert & verify
      expect(component.statsFailed()).toBe(true);
    });

    it('should clear the failure when a retry succeeds', () => {
      // arrange
      mockTransactions.getDescriptions.mockReturnValueOnce(throwError(() => new Error('down')));
      component.loadStats();
      expect(component.statsFailed()).toBe(true);
      mockTransactions.getDescriptions.mockImplementation((p: { unlinkedOnly?: boolean }) =>
        of(page([], p.unlinkedOnly ? 7 : 20)),
      );

      // act
      component.loadStats();

      // assert & verify
      expect(component.statsFailed()).toBe(false);
      expect(component.unlinkedCount()).toBe(7);
    });

    it('should ignore the answer of an older totals load that arrives after a newer one', () => {
      // arrange
      const older = { unlinked: new Subject<unknown>(), any: new Subject<unknown>() };
      const newer = { unlinked: new Subject<unknown>(), any: new Subject<unknown>() };
      const sets = [older, newer];
      let call = 0;
      mockTransactions.getDescriptions.mockImplementation(((p: { unlinkedOnly?: boolean }) => {
        const set = sets[Math.floor(call++ / 2)];
        return (p.unlinkedOnly ? set.unlinked : set.any) as never;
      }) as never);

      // act -- two loads, the newer answers first, then the older one
      component.loadStats();
      component.loadStats();
      newer.unlinked.next(page([], 5));
      newer.unlinked.complete();
      newer.any.next(page([], 9));
      newer.any.complete();
      older.unlinked.next(page([], 99));
      older.unlinked.complete();
      older.any.next(page([], 99));
      older.any.complete();

      // assert & verify
      expect(component.unlinkedCount()).toBe(5);
    });

    it('should show the total number of merchants in the overview, not the number matching a search', () => {
      // arrange -- 312 merchants in all, none match "zzz"
      mockApi.getMerchants.mockImplementation((term: string | null) =>
        of(term ? page([], 0) : page(list, 312)),
      );
      component.loadMerchants();
      component.loadStats();

      // act
      component.onSearchInput('zzz');
      component.page.set(0);
      component.searchTerm.set('zzz');
      component.loadMerchants();
      fixture.detectChanges();

      // assert & verify
      const overview = fixture.nativeElement.querySelector('app-merchant-overview') as HTMLElement;
      expect(component.totalRecords()).toBe(0);
      expect(overview.textContent).toContain('312 merchants');
      expect(overview.textContent).not.toContain('Create a merchant, then link');
    });
  });

  describe('description picker', () => {
    it('should open from the overview in unlinked-only state and ask which merchant to link to', () => {
      // act
      component.openPicker();
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('picker');
      expect(component.pickerTarget()).toBeNull();
      expect(component.pickerUnlinkedOnly()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Link to');
    });

    it('should load descriptions once a target is chosen', () => {
      // arrange
      component.openPicker();
      mockTransactions.getDescriptionGroups.mockClear();

      // act
      component.chooseTarget(costco);

      // assert & verify
      expect(component.pickerTarget()?.id).toBe(2);
      expect(mockTransactions.getDescriptionGroups).toHaveBeenCalledWith({
        search: '',
        unlinkedOnly: true,
        page: 0,
        size: 25,
      });
      expect(component.pickerGroups().map((g) => g.displayName)).toEqual(['KROGER FUEL CTR']);
    });

    it('should pass search and the toggle to the api and load more pages', () => {
      // arrange
      vi.useFakeTimers();
      component.openMerchant(amazon);
      component.openPicker(amazon, false);
      mockTransactions.getDescriptionGroups.mockClear();
      mockTransactions.getDescriptionGroups.mockReturnValue(
        of({ ...page([group('MORE')], 41), unlinkedDescriptionCount: 41 }),
      );

      // act
      component.onPickerSearch('chick');
      vi.advanceTimersByTime(300);
      component.onPickerToggle(true);
      component.onPickerShowMore();

      // assert & verify
      const calls = mockTransactions.getDescriptionGroups.mock.calls.map((c) => c[0]);
      expect(calls[0]).toEqual({ search: 'chick', unlinkedOnly: false, page: 0, size: 25 });
      expect(calls[1]).toEqual({ search: 'chick', unlinkedOnly: true, page: 0, size: 25 });
      expect(calls[2]).toEqual({ search: 'chick', unlinkedOnly: true, page: 1, size: 25 });
      expect(component.pickerGroups().length).toBe(2);
      vi.useRealTimers();
    });

    it('should link ticked descriptions and refresh links, the list and the unlinked figure', () => {
      // arrange
      component.openMerchant(amazon);
      component.openPicker(amazon, false);
      mockApi.getMerchants.mockClear();
      mockApi.getDescriptionLinks.mockClear();
      mockTransactions.getDescriptions.mockClear();

      // act
      component.onLink(['AMZN MKTP', 'AMAZON.COM']);

      // assert & verify
      expect(mockApi.checkDescriptionLinks).toHaveBeenCalledWith(1, ['AMZN MKTP', 'AMAZON.COM']);
      expect(mockApi.addDescriptionLinks.mock.calls).toEqual([[1, ['AMZN MKTP', 'AMAZON.COM']]]);
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(component.mode()).toBe('merchant');
      expect(mockApi.getDescriptionLinks).toHaveBeenCalledWith(1);
      expect(mockApi.getMerchants).toHaveBeenCalled();
      expect(mockTransactions.getDescriptions).toHaveBeenCalledWith(
        expect.objectContaining({ unlinkedOnly: true, size: 1 }),
      );
    });

    it('should keep failed links in the picker and toast the first message', () => {
      // arrange
      component.openMerchant(amazon);
      component.openPicker(amazon, false);
      mockApi.addDescriptionLinks.mockImplementation((_id: number, descriptions: string[]) =>
        descriptions.includes('BAD')
          ? throwError(() => ({ error: { detail: 'Too long.' } }))
          : of(LINK_RESULT),
      );

      // act -- 501 descriptions go in two requests; the one holding BAD fails
      const ticked: string[] = ['BAD', ...Array.from({ length: 500 }, (_, i) => `D${i}`)];
      component.onLink(ticked);

      // assert & verify
      expect(mockApi.addDescriptionLinks).toHaveBeenCalledTimes(2);
      expect(mockToast.error).toHaveBeenCalledWith('Linked 1, 500 failed: Too long.');
      expect(component.mode()).toBe('picker');
      expect(component.pickerFailed().length).toBe(500);
      expect(component.pickerFailed()).toContain('BAD');
    });

    // PF-883
    it('should leave keyboard focus inside the panel after a merchant is chosen to link to', async () => {
      // arrange
      component.openPicker();
      fixture.detectChanges();
      const select = aside().querySelector<HTMLElement>('#link-target');
      select?.focus();
      expect(document.activeElement).toBe(select);

      // act -- the choice replaces the select with the description picker, taking its focus with it
      component.chooseTarget(costco);
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify -- not dropped onto <body> when the "Link to" select goes away
      expect(aside().contains(document.activeElement)).toBe(true);
    });

    it('should show a retry, not an empty message, when the descriptions fail to load, and retry it', () => {
      // arrange
      mockTransactions.getDescriptionGroups.mockReturnValue(throwError(() => new Error('boom')));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      component.openMerchant(amazon);
      component.openPicker(amazon, true);
      expect(component.pickerLoadFailed()).toBe(true);
      mockTransactions.getDescriptionGroups.mockReturnValue(
        of({ ...page([group('AMZN MKTP')], 1), unlinkedDescriptionCount: 1 }),
      );

      // act
      component.retryPicker();

      // assert & verify
      expect(component.pickerLoadFailed()).toBe(false);
      expect(component.pickerGroups().map((g) => g.displayName)).toEqual(['AMZN MKTP']);
    });

    it('should ask before leaving the picker with descriptions ticked', () => {
      // arrange
      component.openMerchant(amazon);
      component.openPicker(amazon, true);
      fixture.detectChanges();
      aside().querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
      fixture.detectChanges();

      // act
      aside().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      // assert & verify
      expect(component.mode()).toBe('picker');
      expect(mockConfirmation.confirm).toHaveBeenCalledTimes(1);
      expect(mockConfirmation.confirm.mock.calls[0][0].header).toBe('Discard selection?');
    });

    it('should leave the picker without asking when nothing is ticked', () => {
      // arrange
      component.openMerchant(amazon);
      component.openPicker(amazon, true);
      fixture.detectChanges();

      // act
      aside().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      // assert & verify
      expect(mockConfirmation.confirm).not.toHaveBeenCalled();
      expect(component.mode()).toBe('overview');
    });

    describe('the "Link to" search', () => {
      afterEach(() => vi.useRealTimers());

      it('should wait for typing to pause and send one request', () => {
        // arrange
        vi.useFakeTimers();
        component.openPicker();
        mockApi.getMerchants.mockClear();

        // act
        component.onTargetFilter('co');
        component.onTargetFilter('cos');
        component.onTargetFilter('cost');
        expect(mockApi.getMerchants).not.toHaveBeenCalled();
        vi.advanceTimersByTime(400);

        // assert & verify
        expect(mockApi.getMerchants).toHaveBeenCalledTimes(1);
        expect(mockApi.getMerchants).toHaveBeenCalledWith('cost', expect.anything());
      });

      it('should not let a slow older answer overwrite a newer one', () => {
        // arrange
        vi.useFakeTimers();
        component.openPicker();
        const older = new Subject<ReturnType<typeof page<Merchant>>>();
        const newer = new Subject<ReturnType<typeof page<Merchant>>>();
        mockApi.getMerchants.mockReset();
        mockApi.getMerchants
          .mockReturnValueOnce(older as never)
          .mockReturnValueOnce(newer as never);

        // act -- two searches far enough apart to both be sent, answered in reverse order
        component.onTargetFilter('co');
        vi.advanceTimersByTime(400);
        component.onTargetFilter('cost');
        vi.advanceTimersByTime(400);
        newer.next(page([costco]));
        older.next(page([amazon, costco, shell]));

        // assert & verify
        expect(component.targetOptions().map((m) => m.name)).toEqual(['Costco']);
      });
    });

    it('should block a second link while one is in flight', () => {
      // arrange
      mockApi.addDescriptionLinks.mockReturnValue(new Subject<DescriptionLinkResult>());
      component.openMerchant(amazon);
      component.openPicker(amazon, false);

      // act
      component.onLink(['A']);
      component.onLink(['B']);

      // assert & verify
      expect(mockApi.addDescriptionLinks).toHaveBeenCalledTimes(1);
    });

    describe('the look-alike guard and the status line', () => {
      const kroger = merchant(4, 'Kroger');
      const fuelCenter = merchant(5, 'Kroger Fuel Center');
      const fuelWarning: LookAlikeWarning = {
        groupName: 'KROGER FUEL CTR',
        words: ['FUEL', 'CTR'],
        descriptions: ['KROGER FUEL CTR #1', 'KROGER FUEL CTR #2'],
        merchants: [fuelCenter],
        nextToGroup: 'KROGER',
      };
      const ticked = ['KROGER #431', 'KROGER #12', 'KROGER FUEL CTR #1', 'KROGER FUEL CTR #2'];

      beforeEach(() => {
        mockApi.getMerchants.mockReturnValue(of(page([...list, kroger, fuelCenter])));
        component.openMerchant(kroger);
        component.openPicker(kroger, true);
      });

      it('should stop and show the warnings instead of linking when the check flags look-alikes', () => {
        // arrange
        mockApi.checkDescriptionLinks.mockReturnValue(
          of({ merchantId: 4, warnings: [fuelWarning] }),
        );

        // act
        component.onLink(ticked);
        fixture.detectChanges();

        // assert & verify
        expect(mockApi.addDescriptionLinks).not.toHaveBeenCalled();
        expect(component.pickerWarnings()).toEqual([fuelWarning]);
        expect(component.linking()).toBe(false);
        expect(aside().querySelector('[data-testid="link-guard"]')?.textContent).toContain(
          "2 of these contain FUEL and CTR, which Kroger doesn't. Kroger Fuel Center exists.",
        );
      });

      it('should link what the guard hands back without checking again', () => {
        // arrange
        mockApi.checkDescriptionLinks.mockReturnValue(
          of({ merchantId: 4, warnings: [fuelWarning] }),
        );
        component.onLink(ticked);
        mockApi.checkDescriptionLinks.mockClear();

        // act -- "Leave those out"
        component.onLinkChecked(['KROGER #431', 'KROGER #12']);

        // assert & verify
        expect(mockApi.checkDescriptionLinks).not.toHaveBeenCalled();
        expect(mockApi.addDescriptionLinks).toHaveBeenCalledWith(4, ['KROGER #431', 'KROGER #12']);
        expect(component.pickerWarnings()).toEqual([]);
      });

      it('should cancel the link when the picker is left while the check runs', () => {
        // arrange
        const check = new Subject<{ merchantId: number; warnings: LookAlikeWarning[] }>();
        mockApi.checkDescriptionLinks.mockReturnValue(check);
        component.onLink(['KROGER #431']);

        // act
        component.back();
        check.next({ merchantId: 4, warnings: [] });
        check.complete();

        // assert & verify
        expect(mockApi.addDescriptionLinks).not.toHaveBeenCalled();
        expect(component.linking()).toBe(false);
        expect(component.mode()).toBe('merchant');
      });

      it('should not start a link while an undo runs, and clear an old status line on another merchant', () => {
        // arrange
        component.onLink(['KROGER #431']);
        const undo = new Subject<never>();
        mockApi.undoDescriptionLinks.mockReturnValue(undo);
        component.undoLastLink();
        component.openPicker(kroger, true);
        mockApi.checkDescriptionLinks.mockClear();

        // act
        component.onLink(['KROGER #12']);

        // assert & verify
        expect(mockApi.checkDescriptionLinks).not.toHaveBeenCalled();

        // act
        undo.complete();
        component.back();
        component.openMerchant(costco);

        // assert & verify
        expect(component.lastLink()).toBeNull();
      });

      it('should link anyway when the check itself fails', () => {
        // arrange
        mockApi.checkDescriptionLinks.mockReturnValue(throwError(() => new Error('down')));

        // act
        component.onLink(['KROGER #431']);

        // assert & verify
        expect(mockApi.addDescriptionLinks).toHaveBeenCalledWith(4, ['KROGER #431']);
      });

      it('should show the status line on the merchant after a link, then undo it and reload', () => {
        // arrange
        const result: DescriptionLinkResult = {
          ...LINK_RESULT,
          merchantId: 4,
          linkedCount: 11,
          transactionsFilled: 205,
        };
        mockApi.addDescriptionLinks.mockReturnValue(of(result));
        component.onLink(['KROGER #431']);
        fixture.detectChanges();
        const status = (): string =>
          aside().querySelector('[data-testid="link-result-announcement"]')?.textContent ?? '';
        expect(component.mode()).toBe('merchant');
        expect(status()).toContain('Linked 11 to Kroger · 205 transactions filled');
        mockApi.getMerchants.mockClear();
        mockApi.getDescriptionLinks.mockClear();
        mockTransactions.getDescriptions.mockClear();

        // act
        aside().querySelector<HTMLButtonElement>('[data-testid="link-result-undo"]')?.click();
        fixture.detectChanges();

        // assert & verify
        expect(mockApi.undoDescriptionLinks).toHaveBeenCalledWith(result);
        expect(status()).toContain('Link undone');
        expect(aside().querySelector('[data-testid="link-result-undo"]')).toBeNull();
        expect(mockApi.getMerchants).toHaveBeenCalled();
        expect(mockApi.getDescriptionLinks).toHaveBeenCalledWith(4);
        expect(mockTransactions.getDescriptions).toHaveBeenCalledWith(
          expect.objectContaining({ unlinkedOnly: true, size: 1 }),
        );
      });
    });

    it('should go back to the merchant, or to the overview when there is none', () => {
      // arrange
      component.openMerchant(amazon);
      component.openPicker(amazon, false);

      // act
      component.back();

      // assert & verify
      expect(component.mode()).toBe('merchant');

      // act
      component.back();
      component.openPicker();
      component.back();

      // assert & verify
      expect(component.mode()).toBe('overview');
    });
  });

  describe('focus', () => {
    it('should not take focus on page load', async () => {
      // arrange
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).not.toBe(aside());
    });

    it('should move focus into the panel when a row is opened and back to that row on return', async () => {
      // arrange
      const row = fixture.nativeElement.querySelector(
        '[data-testid="open-merchant"]',
      ) as HTMLElement;
      row.focus();

      // act
      component.openMerchant(amazon);
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());

      // act
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(row);
    });
  });

  describe('tabs', () => {
    const tab = (label: string): HTMLButtonElement =>
      (
        Array.from(fixture.nativeElement.querySelectorAll('[role=tab]')) as HTMLButtonElement[]
      ).find((t) => t.textContent?.trim().startsWith(label))!;
    const reopen = (params: Params): void => {
      fixture.destroy();
      startParams = params;
      queryParams.next(params);
      fixture = TestBed.createComponent(MerchantsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    };

    afterEach(() => {
      startParams = {};
    });

    it('should open on the Merchants tab with the unlinked count on the Unlinked tab', () => {
      // assert & verify
      expect(component.view()).toBe('merchants');
      expect(tab('Merchants').getAttribute('aria-selected')).toBe('true');
      expect(tab('Unlinked').textContent).toContain('47');
      expect(
        fixture.nativeElement.querySelector('[role=tabpanel]').getAttribute('aria-labelledby'),
      ).toBe('merchant-tab-merchants');
    });

    it('should deep-link to the Unlinked tab and take its count from the groups', () => {
      // act
      reopen({ view: 'unlinked' });

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-unlinked-groups')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-merchant-list')).toBeNull();
      expect(component.unlinkedCount()).toBe(45);
      expect(fixture.nativeElement.textContent).toContain('KROGER FUEL CTR');
    });

    it('should write the chosen tab to the URL, leaving it out for Merchants', () => {
      // act
      tab('Unlinked').click();
      fixture.detectChanges();
      tab('Merchants').click();

      // assert & verify
      expect(mockRouter.navigate).toHaveBeenNthCalledWith(1, [], {
        queryParams: { view: 'unlinked' },
        queryParamsHandling: 'merge',
      });
      expect(mockRouter.navigate).toHaveBeenNthCalledWith(2, [], {
        queryParams: { view: null },
        queryParamsHandling: 'merge',
      });
    });

    it("should open the Unlinked tab from the overview's Link descriptions", () => {
      // act
      const button: HTMLButtonElement = Array.from(
        aside().querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.trim() === 'Link descriptions')!;
      button.click();
      fixture.detectChanges();

      // assert & verify
      expect(component.view()).toBe('unlinked');
      expect(fixture.nativeElement.querySelector('app-unlinked-groups')).not.toBeNull();
    });

    it('should show the merchant rules on the Rules tab, without the panel or Add merchant', () => {
      // act
      reopen({ view: 'rules' });

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('merchant rules section');
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Add merchant');
    });

    it('should follow Back and Forward between tabs', () => {
      // act
      queryParams.next({ view: 'rules' });
      fixture.detectChanges();
      const onRules: string = component.view();
      queryParams.next({});
      fixture.detectChanges();

      // assert & verify
      expect(onRules).toBe('rules');
      expect(component.view()).toBe('merchants');
    });

    it('should ask before leaving the Rules tab with unsaved rule changes', () => {
      // arrange
      reopen({ view: 'rules' });
      fixture.debugElement.injector.get(SettingsGuard).register(() => true);

      // act
      tab('Merchants').click();
      const stayed: string = component.view();
      confirmAccept();

      // assert & verify
      expect(stayed).toBe('rules');
      expect(component.view()).toBe('merchants');
    });

    it('should put the URL back when the user keeps editing after Back', () => {
      // arrange
      reopen({ view: 'rules' });
      fixture.debugElement.injector.get(SettingsGuard).register(() => true);

      // act
      queryParams.next({});
      mockConfirmation.confirm.mock.calls[0][0].reject!();

      // assert & verify
      expect(component.view()).toBe('rules');
      expect(mockRouter.navigate).toHaveBeenLastCalledWith([], {
        queryParams: { view: 'rules' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    it('should ask before the Rules tab hides an edit with unsaved changes', () => {
      // arrange
      component.openMerchant(amazon);
      dirtyForm();

      // act
      tab('Rules').click();
      const stayed: string = component.view();
      confirmAccept();

      // assert & verify
      expect(stayed).toBe('merchants');
      expect(component.view()).toBe('rules');
    });

    it('should guard leaving the page only for unsaved rule changes', async () => {
      // arrange
      const clean: boolean = await component.canLeave();
      fixture.debugElement.injector.get(SettingsGuard).register(() => true);

      // act
      const pending: Promise<boolean> = component.canLeave();
      mockConfirmation.confirm.mock.calls[0][0].reject!();

      // assert & verify
      expect(clean).toBe(true);
      expect(await pending).toBe(false);
    });

    it("should create a merchant for an Unlinked group and hand it back to that group's field", () => {
      // arrange
      reopen({ view: 'unlinked' });
      const groups: UnlinkedGroupsComponent = fixture.debugElement.query(
        By.directive(UnlinkedGroupsComponent),
      ).componentInstance;
      const handBack = vi.spyOn(groups, 'merchantCreated');

      // act
      component.onCreateForGroup({ key: 'kroger fuel ctr', name: 'KROGER FUEL CTR' });
      fixture.detectChanges();
      const prefilled: string = component.addPrefill();
      component.saveMerchant({ name: 'Kroger Fuel Center' });
      fixture.detectChanges();

      // assert & verify
      expect(prefilled).toBe('KROGER FUEL CTR');
      expect(handBack).toHaveBeenCalledWith(
        'kroger fuel ctr',
        expect.objectContaining({ id: 99, name: 'Kroger Fuel Center' }),
      );
      expect(component.mode()).toBe('overview');
    });

    it('should refresh the merchants and totals after a link on the Unlinked tab', () => {
      // arrange
      mockApi.getMerchants.mockClear();
      mockTransactions.getDescriptions.mockClear();

      // act
      component.onGroupsLinked();

      // assert & verify
      expect(mockApi.getMerchants).toHaveBeenCalled();
      expect(mockTransactions.getDescriptions).toHaveBeenCalledWith(
        expect.objectContaining({ unlinkedOnly: true, size: 1 }),
      );
    });
  });
});
