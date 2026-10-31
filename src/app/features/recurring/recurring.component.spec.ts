import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';

import { RecurringComponent } from './recurring.component';
import { RecurringApiService } from './services/recurring-api.service';
import { RecurringEditFormComponent } from './components/recurring-edit-form/recurring-edit-form.component';
import { PatternAcceptance } from './components/pattern-review/pattern-review.component';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import {
  DismissedPattern,
  RecurringFrequency,
  RecurringSuggestion,
  RecurringTransaction,
} from '@models/recurring.model';

const checking = { id: 1, name: 'Checking' } as Account;
const card = { id: 2, name: 'Credit Card' } as Account;
const merchantList = [
  { id: 10, name: 'Netflix' },
  { id: 12, name: 'Hulu' },
] as Merchant[];

const item = (
  id: number,
  name: string,
  amount: number,
  frequency: RecurringFrequency,
  nextDate: string,
  over: Partial<RecurringTransaction> = {},
): RecurringTransaction =>
  ({
    id,
    userId: 1,
    account: checking,
    merchant: { id: 100 + id, name },
    amount,
    frequency,
    nextDate,
    active: true,
    ...over,
  }) as RecurringTransaction;

const netflix = item(1, 'Netflix', 10, 'MONTHLY', '2026-11-03', {
  priceChange: { previousAmount: 10, newAmount: 12, since: '2026-09-03' },
});
const rent = item(2, 'Rent', 1500, 'MONTHLY', '2026-11-01');
const prime = item(3, 'Prime', 139, 'YEARLY', '2027-03-14');
const gym = item(4, 'Gym', 40, 'MONTHLY', '2026-11-05', { active: false });
const items = [netflix, rent, prime, gym];

const pattern = (name: string, over: Partial<RecurringSuggestion> = {}): RecurringSuggestion => ({
  merchant: { name } as Merchant,
  amount: 17.99,
  frequency: 'MONTHLY',
  lastDate: '2026-10-14',
  nextDate: '2026-11-14',
  occurrenceCount: 8,
  confidenceScore: 80,
  accountId: 2,
  accountName: 'Credit Card',
  patternKey: name.toLowerCase(),
  ...over,
});
const hulu = pattern('Hulu');
const planetFit = pattern('PLANET FIT #4471', { amount: 10, patternKey: 'planet fit #4471' });
const dismissedRow: DismissedPattern = {
  id: 5,
  patternKey: 'old',
  name: 'Old',
  dismissedAt: '2026-10-01T00:00:00Z',
};

describe('RecurringComponent', () => {
  let component: RecurringComponent;
  let fixture: ComponentFixture<RecurringComponent>;
  let mockApi: Mocked<
    Pick<
      RecurringApiService,
      | 'getAll'
      | 'getSuggestions'
      | 'getDismissed'
      | 'create'
      | 'update'
      | 'delete'
      | 'dismiss'
      | 'restore'
    >
  >;
  let mockAccounts: Mocked<Pick<AccountApiService, 'getAccounts'>>;
  let mockMerchants: Mocked<
    Pick<
      MerchantApiService,
      'getMerchants' | 'createMerchant' | 'addDescriptionLink' | 'deleteMerchant'
    >
  >;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmation: { confirm: Mock<(confirmation: Confirmation) => void> };

  const confirmAccept = (index = 0): void =>
    mockConfirmation.confirm.mock.calls[index][0].accept!();
  const page = <T>(content: T[]) => ({
    content,
    page: { totalElements: content.length, totalPages: 1, number: 0, size: 20 },
  });
  const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');
  const dirtyForm = (): void => {
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(RecurringEditFormComponent))
      .componentInstance as RecurringEditFormComponent;
    form.form.markAsDirty();
  };
  const accept = (over: Partial<PatternAcceptance> = {}): PatternAcceptance => ({
    pattern: hulu,
    merchantId: 12,
    merchantName: 'Streaming Co',
    newMerchantName: null,
    accountId: 2,
    amount: 17.99,
    frequency: 'MONTHLY',
    nextDate: '2026-11-14',
    ...over,
  });

  beforeEach(async () => {
    mockApi = {
      getAll: vi.fn().mockReturnValue(of(items)),
      getSuggestions: vi.fn().mockReturnValue(of([hulu, planetFit])),
      getDismissed: vi.fn().mockReturnValue(of([dismissedRow])),
      create: vi.fn().mockReturnValue(of(55)),
      update: vi.fn().mockReturnValue(of(1)),
      delete: vi.fn().mockReturnValue(of(undefined)),
      dismiss: vi.fn().mockReturnValue(of(6)),
      restore: vi.fn().mockReturnValue(of(undefined)),
    };
    mockAccounts = { getAccounts: vi.fn().mockReturnValue(of([checking, card])) };
    mockMerchants = {
      getMerchants: vi.fn().mockReturnValue(of(page(merchantList))),
      createMerchant: vi.fn().mockReturnValue(of(99)),
      addDescriptionLink: vi.fn().mockReturnValue(of(undefined)),
      deleteMerchant: vi.fn().mockReturnValue(of(undefined)),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmation = { confirm: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RecurringComponent, NoopAnimationsModule],
      providers: [
        { provide: RecurringApiService, useValue: mockApi },
        { provide: AccountApiService, useValue: mockAccounts },
        { provide: MerchantApiService, useValue: mockMerchants },
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmation },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecurringComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('loading and the list', () => {
    it('should open on the overview with the grouped list and totals', () => {
      // assert & verify
      expect(component.mode()).toBe('overview');
      expect(component.groups().map((g) => g.key)).toEqual(['MONTHLY', 'YEARLY', 'PAUSED']);
      expect(component.totals().services).toBe(3);
      expect(fixture.nativeElement.textContent).toContain('You pay about');
    });

    it('should show the strip only when patterns exist', () => {
      // assert & verify
      expect(fixture.nativeElement.querySelector('[data-testid="patterns-strip"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('2 patterns found');

      // arrange
      mockApi.getSuggestions.mockReturnValue(of([]));

      // act
      component.loadPatterns();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('[data-testid="patterns-strip"]')).toBeNull();
    });

    it('should show the error page and clear stale rows when the list fails', () => {
      // arrange
      mockApi.getAll.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadItems();
      fixture.detectChanges();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load recurring items');
      expect(component.items()).toEqual([]);
      expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
    });

    it('should drop a slower response from an earlier load', () => {
      // arrange
      const pending: Subject<RecurringTransaction[]>[] = [];
      mockApi.getAll.mockImplementation(() => {
        const request = new Subject<RecurringTransaction[]>();
        pending.push(request);
        return request;
      });

      // act
      component.loadItems();
      component.loadItems();
      pending[1].next([rent]);
      pending[0].next([netflix]);

      // assert & verify
      expect(component.items().map((i) => i.id)).toEqual([2]);
    });

    it('should keep the same panel element mounted across a reload', () => {
      // arrange
      const panel = fixture.nativeElement.querySelector('app-side-panel');

      // act
      component.loadItems();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBe(panel);
    });

    it('should show an error in the review only when patterns fail to load', () => {
      // arrange
      mockApi.getSuggestions.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadPatterns();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('[data-testid="patterns-strip"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-recurring-list')).not.toBeNull();

      // act
      component.openReview();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain("Couldn't load patterns");
    });

    it('should open add mode with no Back or Close when nothing is tracked and no patterns exist', () => {
      // arrange
      mockApi.getAll.mockReturnValue(of([]));
      mockApi.getSuggestions.mockReturnValue(of([]));

      // act
      component.loadItems();
      component.loadPatterns();
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('add');
      expect(component.onlyAddMode()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Nothing tracked yet');
    });

    it('should stay on the overview with a Review patterns button when nothing is tracked but patterns exist', () => {
      // arrange
      mockApi.getAll.mockReturnValue(of([]));

      // act
      component.loadItems();
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('overview');
      expect(fixture.nativeElement.textContent).toContain('Review patterns');
    });
  });

  describe('items', () => {
    it('should open an item and return on Back, Close and Escape', () => {
      // act
      component.openItem(rent);
      fixture.detectChanges();

      // assert & verify
      expect(component.mode()).toBe('item');
      expect(component.selected()?.id).toBe(2);

      // act & assert
      component.back();
      expect(component.mode()).toBe('overview');
      component.openItem(rent);
      component.onPanelClose();
      expect(component.mode()).toBe('overview');
      component.openItem(rent);
      aside().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(component.mode()).toBe('overview');
    });

    it('should ask to discard unsaved changes before every move away', () => {
      // arrange
      component.openItem(rent);
      dirtyForm();

      // act
      component.openItem(netflix);
      component.back();
      component.onPanelClose();
      component.startAdd();
      component.openReview();

      // assert & verify
      expect(mockConfirmation.confirm).toHaveBeenCalledTimes(5);
      expect(mockConfirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');
      expect(component.mode()).toBe('item');

      // act
      confirmAccept(3);

      // assert & verify
      expect(component.mode()).toBe('add');
    });

    it('should not open a just-added item over a later add form when the reload failed', () => {
      // arrange
      mockApi.getAll.mockReturnValueOnce(throwError(() => new Error('down')));
      component.startAdd();
      component.saveItem({
        merchantId: 10,
        accountId: 1,
        amount: 80,
        frequency: 'MONTHLY',
        nextDate: '2026-11-20',
        active: true,
      });
      mockApi.getAll.mockReturnValue(of([...items, item(55, 'Gas', 80, 'MONTHLY', '2026-11-20')]));
      component.startAdd();

      // act -- a later, successful reload
      component.loadItems();

      // assert & verify (PF-885)
      expect(component.mode()).toBe('add');
      expect(component.selected()).toBeNull();
    });

    it('should add an item and open it', () => {
      // arrange
      mockApi.getAll.mockReturnValue(of([...items, item(55, 'Gas', 80, 'MONTHLY', '2026-11-20')]));
      component.startAdd();

      // act
      component.saveItem({
        merchantId: 10,
        accountId: 1,
        amount: 80,
        frequency: 'MONTHLY',
        nextDate: '2026-11-20',
        active: true,
      });

      // assert & verify
      expect(mockApi.create).toHaveBeenCalledWith({
        userId: 1,
        merchantId: 10,
        accountId: 1,
        amount: 80,
        frequency: 'MONTHLY',
        nextDate: '2026-11-20',
        active: true,
      });
      expect(mockToast.success).toHaveBeenCalledWith('Recurring item added');
      expect(component.mode()).toBe('item');
      expect(component.selected()?.id).toBe(55);
    });

    it('should save changes to an item', () => {
      // arrange
      component.openItem(rent);

      // act
      component.saveItem({
        id: 2,
        merchantId: 102,
        accountId: 1,
        amount: 1550,
        frequency: 'MONTHLY',
        nextDate: '2026-11-01',
        active: true,
      });

      // assert & verify
      expect(mockApi.update).toHaveBeenCalledWith({
        id: 2,
        merchantId: 102,
        accountId: 1,
        amount: 1550,
        frequency: 'MONTHLY',
        nextDate: '2026-11-01',
        active: true,
      });
      expect(mockToast.success).toHaveBeenCalledWith('Recurring item updated');
    });

    it('should update the price to the new amount', () => {
      // arrange
      component.openItem(netflix);

      // act
      component.updatePrice();

      // assert & verify
      expect(mockApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, amount: 12, active: true, nextDate: '2026-11-03' }),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Price updated');
    });

    it('should pause and resume through update', () => {
      // arrange
      component.openItem(rent);

      // act
      component.togglePaused();

      // assert & verify
      expect(mockApi.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 2, active: false }),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Paused');

      // act
      component.openItem(gym);
      component.togglePaused();

      // assert & verify
      expect(mockApi.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 4, active: true }),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Resumed');
    });

    // PF-869: account_id is nullable in the database, and an update request needs an account
    it('should not send an update for an item that has no account, and say why', () => {
      // arrange
      component.openItem({ ...rent, account: null });

      // act
      component.togglePaused();

      // assert & verify
      expect(mockApi.update).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith(
        'This item has no account yet. Edit it and choose one first.',
      );
    });

    it('should delete after confirmation and return to the overview', () => {
      // arrange
      component.openItem(rent);

      // act
      component.deleteItem();
      expect(mockConfirmation.confirm.mock.calls[0][0].message).toContain('Rent');
      confirmAccept();

      // assert & verify
      expect(mockApi.delete).toHaveBeenCalledWith(2);
      expect(mockToast.success).toHaveBeenCalledWith('Recurring item deleted');
      expect(component.mode()).toBe('overview');
    });

    it('should return to the overview with a toast when the shown item no longer exists', () => {
      // arrange
      component.openItem(rent);
      mockApi.getAll.mockReturnValue(of([netflix]));

      // act
      component.loadItems();

      // assert & verify
      expect(component.mode()).toBe('overview');
      expect(mockToast.error).toHaveBeenCalledWith('That item no longer exists.');
    });

    it('should show the saved amount in the form and clear the note after Update price', () => {
      // arrange
      component.openItem(netflix);
      fixture.detectChanges();
      mockApi.getAll.mockReturnValue(
        of([{ ...netflix, amount: 12, priceChange: null }, rent, prime, gym]),
      );

      // act
      component.updatePrice();
      fixture.detectChanges();

      // assert & verify
      const form = fixture.debugElement.query(By.directive(RecurringEditFormComponent))
        .componentInstance as RecurringEditFormComponent;
      expect(form.form.controls.amount.value).toBe(12);
      expect(fixture.nativeElement.querySelector('[data-testid="price-change"]')).toBeNull();
    });

    it('should save while the list is still reloading instead of dropping the click', () => {
      // arrange
      component.openItem(rent);
      mockApi.getAll.mockReturnValue(new Subject<RecurringTransaction[]>());
      component.loadItems();

      // act
      component.saveItem({
        id: 2,
        merchantId: 102,
        accountId: 1,
        amount: 1,
        frequency: 'MONTHLY',
        nextDate: '2026-11-01',
        active: true,
      });

      // assert & verify
      expect(mockApi.update).toHaveBeenCalledTimes(1);
    });

    it('should accept a pattern while the list is still reloading', () => {
      // arrange
      component.openReview();
      component.choosePattern(hulu);
      mockApi.getAll.mockReturnValue(new Subject<RecurringTransaction[]>());
      component.loadItems();

      // act
      component.acceptPattern(accept());

      // assert & verify
      expect(mockApi.create).toHaveBeenCalledTimes(1);
    });

    it('should block a second save, delete or accept while one is in flight', () => {
      // arrange
      mockApi.update.mockReturnValue(new Subject<number>());
      component.openItem(rent);
      const value = {
        id: 2,
        merchantId: 102,
        accountId: 1,
        amount: 1,
        frequency: 'MONTHLY' as RecurringFrequency,
        nextDate: '2026-11-01',
        active: true,
      };

      // act
      component.saveItem(value);
      component.saveItem(value);
      component.togglePaused();
      component.deleteItem();
      component.acceptPattern(accept());

      // assert & verify
      expect(mockApi.update).toHaveBeenCalledTimes(1);
      expect(mockApi.create).not.toHaveBeenCalled();
      expect(mockMerchants.addDescriptionLink).not.toHaveBeenCalled();
      expect(mockConfirmation.confirm).not.toHaveBeenCalled();
    });
  });

  describe('review', () => {
    it('should open the review from the strip and the overview', () => {
      // act
      component.openReview();

      // assert & verify
      expect(component.mode()).toBe('review');
    });

    it('should search merchants by the detected name before opening the form', () => {
      // arrange
      component.openReview();
      mockMerchants.getMerchants.mockClear();

      // act
      component.choosePattern(hulu);

      // assert & verify
      expect(mockMerchants.getMerchants).toHaveBeenCalledWith('Hulu', { page: 0, size: 20 });
      expect(component.mode()).toBe('review-form');
      expect(component.selectedPattern()?.patternKey).toBe('hulu');
    });

    it('should accept a pattern with an existing merchant: link, create, and remove it from the list', () => {
      // arrange
      component.openReview();
      component.choosePattern(hulu);

      // act
      component.acceptPattern(accept());

      // assert & verify
      expect(mockMerchants.createMerchant).not.toHaveBeenCalled();
      expect(mockMerchants.addDescriptionLink).toHaveBeenCalledWith(12, 'Hulu');
      expect(mockApi.create).toHaveBeenCalledWith({
        userId: 1,
        merchantId: 12,
        accountId: 2,
        amount: 17.99,
        frequency: 'MONTHLY',
        nextDate: '2026-11-14',
        active: true,
      });
      expect(component.patterns().map((p) => p.patternKey)).toEqual(['planet fit #4471']);
      expect(mockToast.success).toHaveBeenCalledWith('Added to recurring');
      expect(component.mode()).toBe('review');
    });

    it('should create a merchant first when the review asks to', () => {
      // arrange
      component.openReview();
      component.choosePattern(planetFit);

      // act
      component.acceptPattern(
        accept({ pattern: planetFit, merchantId: null, newMerchantName: 'Planet Fit', amount: 10 }),
      );

      // assert & verify
      expect(mockMerchants.createMerchant).toHaveBeenCalledWith({ userId: 1, name: 'Planet Fit' });
      expect(mockMerchants.addDescriptionLink).toHaveBeenCalledWith(99, 'PLANET FIT #4471');
      expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 99 }));
    });

    it('should not create the item when linking fails, and reuse the created merchant on retry', () => {
      // arrange
      mockMerchants.addDescriptionLink.mockReturnValueOnce(
        throwError(() => ({ error: { detail: 'Too long.' } })),
      );
      component.openReview();
      component.choosePattern(planetFit);
      const acceptance = accept({
        pattern: planetFit,
        merchantId: null,
        newMerchantName: 'Planet Fit',
      });

      // act
      component.acceptPattern(acceptance);

      // assert & verify
      expect(mockApi.create).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith('Too long.');
      expect(component.mode()).toBe('review-form');

      // act -- retry
      component.acceptPattern(acceptance);

      // assert & verify
      expect(mockMerchants.createMerchant).toHaveBeenCalledTimes(1);
      expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 99 }));
    });

    describe('retries and leftovers (PF-885)', () => {
      const failLinkOnce = (): void => {
        mockMerchants.addDescriptionLink.mockReturnValueOnce(
          throwError(() => ({ error: { detail: 'Too long.' } })),
        );
      };
      const createAcceptance = (name: string): PatternAcceptance =>
        accept({ pattern: planetFit, merchantId: null, merchantName: null, newMerchantName: name });

      it('should create a new merchant and remove the old one when the retry changes the name', () => {
        // arrange
        failLinkOnce();
        component.openReview();
        component.choosePattern(planetFit);
        component.acceptPattern(createAcceptance('Planet Fit'));
        mockMerchants.createMerchant.mockReturnValueOnce(of(100));

        // act
        component.acceptPattern(createAcceptance('Planet Fitness'));

        // assert & verify
        expect(mockMerchants.createMerchant).toHaveBeenCalledTimes(2);
        expect(mockMerchants.deleteMerchant).toHaveBeenCalledWith(99);
        expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 100 }));
      });

      it('should drop the created merchant when the retry picks another merchant', () => {
        // arrange
        failLinkOnce();
        component.openReview();
        component.choosePattern(planetFit);
        component.acceptPattern(createAcceptance('Planet Fit'));

        // act
        component.acceptPattern(accept({ pattern: planetFit, merchantId: 12 }));

        // assert & verify
        expect(mockMerchants.deleteMerchant).toHaveBeenCalledWith(99);
        expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 12 }));
      });

      it('should remove an unused created merchant when the user leaves the form', () => {
        // arrange
        failLinkOnce();
        component.openReview();
        component.choosePattern(planetFit);
        component.acceptPattern(createAcceptance('Planet Fit'));

        // act
        component.back();

        // assert & verify
        expect(mockMerchants.deleteMerchant).toHaveBeenCalledWith(99);
      });

      it('should not store a description link that only repeats the merchant name', () => {
        // act
        component.openReview();
        component.choosePattern(hulu);
        component.acceptPattern(accept({ merchantName: ' hulu ' }));

        // assert & verify
        expect(mockMerchants.addDescriptionLink).not.toHaveBeenCalled();
        expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 12 }));
      });

      it('should not store a link for a new merchant named exactly like the detected text', () => {
        // act
        component.openReview();
        component.choosePattern(planetFit);
        component.acceptPattern(createAcceptance('planet fit #4471'));

        // assert & verify
        expect(mockMerchants.addDescriptionLink).not.toHaveBeenCalled();
        expect(mockApi.create).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 99 }));
      });

      it('should keep the pattern review merchants apart from the edit form search', () => {
        // arrange
        component.openReview();
        component.choosePattern(hulu);
        const forPatterns = component.patternMerchants();
        mockMerchants.getMerchants.mockReturnValue(of(page([{ id: 77, name: 'Zed' } as Merchant])));

        // act
        component.onMerchantFilter('zed');

        // assert & verify
        expect(component.merchants().map((m) => m.id)).toEqual([77]);
        expect(component.patternMerchants()).toBe(forPatterns);
      });
    });

    it('should ignore a finished accept after the user went back', () => {
      // arrange
      const pending = new Subject<number>();
      mockApi.create.mockReturnValue(pending);
      component.openReview();
      component.choosePattern(hulu);
      component.acceptPattern(accept());

      // act
      component.back();
      component.back();
      pending.next(55);
      pending.complete();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Added to recurring');
      expect(component.mode()).toBe('overview');
    });

    it('should dismiss a pattern and move it to the dismissed list', () => {
      // arrange
      component.openReview();
      component.choosePattern(hulu);

      // act
      component.dismissPattern(hulu);

      // assert & verify
      expect(mockApi.dismiss).toHaveBeenCalledWith('hulu', 'Hulu');
      expect(component.patterns().map((p) => p.patternKey)).toEqual(['planet fit #4471']);
      expect(component.dismissed().map((d) => d.patternKey)).toContain('hulu');
      expect(mockToast.success).toHaveBeenCalledWith('Dismissed');
      expect(component.mode()).toBe('review');
    });

    it('should restore a dismissed pattern and detect it again', () => {
      // arrange
      mockApi.getSuggestions.mockClear();

      // act
      component.restorePattern(dismissedRow);

      // assert & verify
      expect(mockApi.restore).toHaveBeenCalledWith(5);
      expect(component.dismissed()).toEqual([]);
      expect(mockApi.getSuggestions).toHaveBeenCalled();
    });

    it('should go back from the form to the list and from the list to the overview', () => {
      // arrange
      component.openReview();
      component.choosePattern(hulu);

      // act & assert
      component.back();
      expect(component.mode()).toBe('review');
      expect(component.selectedPattern()).toBeNull();
      component.back();
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
      const row = fixture.nativeElement.querySelector('[data-testid="open-item"]') as HTMLElement;
      row.focus();

      // act
      component.openItem(rent);
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
