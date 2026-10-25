import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';

import { MerchantsComponent } from './merchants.component';
import { MerchantApiService } from './services/merchant-api.service';
import { MerchantEditFormComponent } from './components/merchant-edit-form/merchant-edit-form.component';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import { Merchant, MerchantDescriptionLink, TransactionDescription } from '@models/merchant.model';

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
const page = <T>(content: T[], total = content.length) => ({
  content,
  page: { totalElements: total, totalPages: 1, number: 0, size: 20 },
});

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
      | 'deleteDescriptionLink'
    >
  >;
  let mockTransactions: Mocked<Pick<TransactionApiService, 'getDescriptions'>>;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmation: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: Mocked<Pick<Router, 'navigate'>>;

  const confirmAccept = (index = 0): void =>
    mockConfirmation.confirm.mock.calls[index][0].accept!();
  const dirtyForm = (): void => {
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(MerchantEditFormComponent))
      .componentInstance as MerchantEditFormComponent;
    form.form.markAsDirty();
  };
  const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');

  beforeEach(async () => {
    mockApi = {
      getMerchants: vi.fn().mockReturnValue(of(page(list, 312))),
      createMerchant: vi.fn().mockReturnValue(of(99)),
      updateMerchant: vi.fn().mockReturnValue(of(1)),
      deleteMerchant: vi.fn().mockReturnValue(of(undefined)),
      getDescriptionLinks: vi.fn().mockReturnValue(of(links)),
      addDescriptionLink: vi.fn().mockReturnValue(of(undefined)),
      deleteDescriptionLink: vi.fn().mockReturnValue(of(undefined)),
    };
    mockTransactions = {
      getDescriptions: vi
        .fn()
        .mockImplementation((p: { unlinkedOnly?: boolean; size: number }) =>
          p.size === 1
            ? of(page([], p.unlinkedOnly ? 47 : 100))
            : of(page([row('AMZN MKTP'), row('COSTCO #12', 2)], 2)),
        ),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmation = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MerchantsComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockApi },
        { provide: TransactionApiService, useValue: mockTransactions },
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmation },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

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

    it('should clear the rows and show the error page when loading fails', () => {
      // arrange
      mockApi.getMerchants.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadMerchants();
      fixture.detectChanges();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load merchants');
      expect(component.merchants()).toEqual([]);
      expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
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
      const pending = new Subject<void>();
      mockApi.addDescriptionLink.mockReturnValue(pending);
      component.openMerchant(amazon);
      component.openPicker(amazon, false);
      component.onLink(['A']);
      component.back();
      component.back();
      component.openMerchant(costco);

      // act
      pending.next();
      pending.complete();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Linked 1 description');
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
      expect(mockTransactions.getDescriptions).toHaveBeenCalledWith(
        expect.objectContaining({ unlinkedOnly: true, page: 0, size: 20 }),
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
      mockTransactions.getDescriptions.mockClear();

      // act
      component.chooseTarget(costco);

      // assert & verify
      expect(component.pickerTarget()?.id).toBe(2);
      expect(mockTransactions.getDescriptions).toHaveBeenCalledWith({
        search: '',
        unlinkedOnly: true,
        page: 0,
        size: 20,
      });
      expect(component.pickerRows().map((r) => r.description)).toEqual(['AMZN MKTP', 'COSTCO #12']);
    });

    it('should pass search and the toggle to the api and load more pages', () => {
      // arrange
      vi.useFakeTimers();
      component.openMerchant(amazon);
      component.openPicker(amazon, false);
      mockTransactions.getDescriptions.mockClear();
      mockTransactions.getDescriptions.mockReturnValue(of(page([row('MORE')], 41)));

      // act
      component.onPickerSearch('chick');
      vi.advanceTimersByTime(300);
      component.onPickerToggle(true);
      component.onPickerShowMore();

      // assert & verify
      const calls = mockTransactions.getDescriptions.mock.calls.map((c) => c[0]);
      expect(calls[0]).toEqual({ search: 'chick', unlinkedOnly: false, page: 0, size: 20 });
      expect(calls[1]).toEqual({ search: 'chick', unlinkedOnly: true, page: 0, size: 20 });
      expect(calls[2]).toEqual({ search: 'chick', unlinkedOnly: true, page: 1, size: 20 });
      expect(component.pickerRows().length).toBe(2);
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
      expect(mockApi.addDescriptionLink.mock.calls).toEqual([
        [1, 'AMZN MKTP'],
        [1, 'AMAZON.COM'],
      ]);
      expect(mockToast.success).toHaveBeenCalledWith('Linked 2 descriptions');
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
      mockApi.addDescriptionLink.mockImplementation((_id: number, description: string) =>
        description === 'BAD'
          ? throwError(() => ({ error: { detail: 'Too long.' } }))
          : of(undefined),
      );

      // act
      component.onLink(['GOOD', 'BAD']);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Linked 1, 1 failed: Too long.');
      expect(component.mode()).toBe('picker');
      expect(component.pickerFailed()).toEqual(['BAD']);
    });

    it('should block a second link while one is in flight', () => {
      // arrange
      mockApi.addDescriptionLink.mockReturnValue(new Subject<void>());
      component.openMerchant(amazon);
      component.openPicker(amazon, false);

      // act
      component.onLink(['A']);
      component.onLink(['B']);

      // assert & verify
      expect(mockApi.addDescriptionLink).toHaveBeenCalledTimes(1);
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
});
