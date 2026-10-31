import { vi, Mocked } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Account, AccountType } from '@models/account.model';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { NetWorthBreakdown, NetWorthGroup } from '../../models/reports.model';
import { ReportApiService } from '../../services/report-api.service';
import { NetWorthState } from '../../utils/net-worth-state';
import { NetWorthViewComponent, NetWorthParamsChange } from './net-worth-view.component';

const group = (over: Partial<NetWorthGroup>): NetWorthGroup => ({
  key: 'SAVINGS',
  label: 'Savings',
  kind: 'ASSET',
  typeCode: 'SAVINGS',
  accountCount: 2,
  balance: 42900,
  previousBalance: 40000,
  comparisonBalance: null,
  series: [40000, 42900],
  story: null,
  ...over,
});
const typeGroups = [
  group({}),
  group({
    key: 'CHECKING',
    label: 'Checking',
    typeCode: 'CHECKING',
    balance: 22600,
    previousBalance: 23000,
  }),
  group({
    key: 'CREDIT_CARD',
    label: 'Credit cards',
    kind: 'DEBT',
    typeCode: 'CREDIT_CARD',
    balance: -43470,
    previousBalance: -47820,
  }),
];
const accountGroups = [
  group({
    key: '9',
    label: 'Ally High Yield',
    accountCount: 1,
    balance: 30000,
    previousBalance: 27990,
    story: {
      openingBalance: 27990,
      closingBalance: 30000,
      deposits: 9200,
      withdrawals: 7800,
      interestAndAdjustments: 610,
    },
  }),
  group({
    key: '10',
    label: 'Emergency fund',
    accountCount: 1,
    balance: 12900,
    previousBalance: 12000,
  }),
];
const breakdown = (groups: NetWorthGroup[]): NetWorthBreakdown => ({
  points: [
    { date: '2026-09-30', assets: 170000, debts: 45000, netWorth: 125000, partial: false },
    { date: '2026-10-31', assets: 171900, debts: 43470, netWorth: 128430, partial: true },
  ],
  opening: { date: '2025-09-30', assets: 159000, debts: 45000, netWorth: 114000, partial: false },
  asOf: '2026-10-31',
  summary: {
    netWorth: 128430,
    assets: 171900,
    debts: 43470,
    liquidCash: 22600,
    averageMonthlySpending: 5512,
    monthsCovered: 4.1,
  },
  moved: { change: 14430, saved: 9860, other: 4570 },
  comparison: null,
  groups,
});
const accounts = [
  { id: 9, name: 'Ally High Yield' },
  { id: 10, name: 'Emergency fund' },
] as Account[];
const types = [
  { code: 'SAVINGS', label: 'Savings' },
  { code: 'CHECKING', label: 'Checking' },
] as AccountType[];

describe('NetWorthViewComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthViewComponent>;
  let component: NetWorthViewComponent;
  let api: Mocked<Pick<ReportApiService, 'getNetWorthBreakdown'>>;
  let router: Mocked<Pick<Router, 'navigate'>>;
  let emitted: NetWorthParamsChange[];

  const lastRequest = (): NetWorthState => api.getNetWorthBreakdown.mock.calls.at(-1)![0];
  const text = (): string => (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');

  async function create(params: Record<string, string> = {}): Promise<void> {
    fixture = TestBed.createComponent(NetWorthViewComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.paramsChange.subscribe((c: NetWorthParamsChange) => emitted.push(c));
    fixture.componentRef.setInput('params', params);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.detectChanges();
    await settle();
  }
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    api = {
      getNetWorthBreakdown: vi
        .fn()
        .mockImplementation((s: NetWorthState) =>
          of(breakdown(s.typeCode !== null || s.accountId !== null ? accountGroups : typeGroups)),
        ),
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [NetWorthViewComponent, NoopAnimationsModule],
      providers: [
        { provide: ReportApiService, useValue: api },
        { provide: Router, useValue: router },
        {
          provide: AccountApiService,
          useValue: { getAccountTypes: vi.fn().mockReturnValue(of(types)) },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  it('should load the breakdown for the default state', async () => {
    // act
    await create();

    // assert & verify
    expect(api.getNetWorthBreakdown).toHaveBeenCalledTimes(1);
    expect(lastRequest().measure).toBe('NET_WORTH');
    expect(lastRequest().compare).toBe('NONE');
    expect(text()).toContain('$128,430');
    expect(text()).toContain('Savings');
  });

  it('should hydrate from nw parameters and write every change back', async () => {
    // arrange
    await create({
      nwStart: '2026-01-01',
      nwEnd: '2026-06-30',
      nwRange: 'Custom',
      nwCompare: 'YEAR_AGO',
    });

    // act
    component['onState']({ measure: 'DEBTS' });
    await settle();

    // assert & verify
    expect(lastRequest()).toMatchObject({
      startDate: '2026-01-01',
      compare: 'YEAR_AGO',
      measure: 'DEBTS',
    });
    expect(emitted.at(-1)!.params).toMatchObject({
      nwMeasure: 'DEBTS',
      nwCompare: 'YEAR_AGO',
      nwStart: '2026-01-01',
    });
  });

  it('should fall back with a note for an invalid URL', async () => {
    // act
    await create({ nwMeasure: 'NOPE' });

    // assert & verify
    expect(component['state']().measure).toBe('NET_WORTH');
    expect(text()).toContain("couldn't be used");
  });

  it('should drill from a type to its accounts and step back', async () => {
    // arrange
    await create();

    // act
    component['onOpenGroup'](typeGroups[0]);
    await settle();

    // assert & verify
    expect(lastRequest().typeCode).toBe('SAVINGS');
    expect(text()).toContain('Ally High Yield');
    expect(emitted.at(-1)!.push).toBe(true);

    // act
    component['stepBack']();
    await settle();

    // assert & verify
    expect(lastRequest().typeCode).toBeNull();
    expect(text()).toContain('Credit cards');
  });

  it("should open an account's story", async () => {
    // arrange
    await create();
    component['onOpenGroup'](typeGroups[0]);
    await settle();

    // act
    component['onOpenGroup'](accountGroups[0]);
    await settle();

    // assert & verify
    expect(component['state']().accountId).toBe(9);
    expect(text()).toContain('Deposits $9,200');
    expect(text()).toContain('Interest and adjustments +$610');
  });

  it('should drop a drilled account that the account filter excludes', async () => {
    // arrange
    await create({ nwAccounts: '9,10', nwAccount: '9' });
    expect(component['state']().accountId).toBe(9);

    // act
    component['onState']({ accountIds: [10], accountId: null });
    await settle();

    // assert & verify
    expect(component['state']().accountId).toBeNull();
    expect(lastRequest().accountIds).toEqual([10]);
  });

  it("should request a month's accounts when a month is picked", async () => {
    // arrange
    await create();

    // act
    component['onMonth']('2026-09');
    await settle();

    // assert & verify
    expect(lastRequest().month).toBe('2026-09');
    expect(emitted.at(-1)!.params['nwMonth']).toBe('2026-09');
  });

  it('should send the comparison and show its label', async () => {
    // arrange
    api.getNetWorthBreakdown.mockReturnValue(
      of({
        ...breakdown(typeGroups),
        comparison: {
          label: 'a year ago',
          start: '2025-10-01',
          end: '2025-10-31',
          netWorth: 114310,
          assets: 159000,
          debts: 47820,
        },
      }),
    );
    await create();

    // act
    component['onState']({ compare: 'YEAR_AGO' });
    await settle();

    // assert & verify
    expect(lastRequest().compare).toBe('YEAR_AGO');
    expect(text()).toContain('vs a year ago');
  });

  it('should drop a slower response from an earlier state', async () => {
    // arrange
    await create();
    const slow = new Subject<NetWorthBreakdown>();
    const fast = new Subject<NetWorthBreakdown>();
    api.getNetWorthBreakdown.mockReturnValueOnce(slow).mockReturnValueOnce(fast);

    // act -- two changes, answered newest first
    component['onState']({ measure: 'ASSETS' });
    component['onState']({ measure: 'DEBTS' });
    fast.next({
      ...breakdown(typeGroups),
      summary: { ...breakdown(typeGroups).summary, netWorth: 1 },
    });
    slow.next({
      ...breakdown(typeGroups),
      summary: { ...breakdown(typeGroups).summary, netWorth: 2 },
    });
    await settle();

    // assert & verify
    expect(component['breakdown']()?.summary.netWorth).toBe(1);
  });

  it('should show the error page and clear stale data when loading fails', async () => {
    // arrange
    await create();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.getNetWorthBreakdown.mockReturnValue(throwError(() => new Error('down')));

    // act
    component['onState']({ compare: 'YEAR_AGO' });
    await settle();

    // assert & verify
    expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
    expect(component['breakdown']()).toBeNull();
  });

  it('should show the empty state when there are no accounts', async () => {
    // arrange
    api.getNetWorthBreakdown.mockReturnValue(of({ ...breakdown([]), points: [] }));

    // act
    await create();

    // assert & verify
    expect(text()).toContain('No accounts yet');
  });

  it('should open the explorer filtered to an account, and Accounts at that account', async () => {
    // arrange
    await create();
    component['onOpenGroup'](typeGroups[0]);
    await settle();
    component['onOpenGroup'](accountGroups[0]);
    await settle();

    // act
    component['onExplorer']({ accountIds: '9', measure: 'SPENDING' });
    component['onAccounts'](9);

    // assert & verify
    expect(router.navigate).toHaveBeenNthCalledWith(1, ['/reports'], {
      queryParams: { accountIds: '9', measure: 'SPENDING' },
    });
    expect(router.navigate).toHaveBeenNthCalledWith(2, ['/accounts'], {
      queryParams: { accountId: 9 },
    });
  });

  it('should follow the URL when it changes underneath, and ignore what it wrote itself', async () => {
    // arrange
    await create();
    api.getNetWorthBreakdown.mockClear();

    // act -- its own write coming back changes nothing
    fixture.componentRef.setInput('params', emitted.at(-1)?.params ?? {});
    await settle();
    // act -- a different URL (browser Back) is followed
    fixture.componentRef.setInput('params', {
      nwMeasure: 'ASSETS',
      nwStart: '2026-01-01',
      nwEnd: '2026-06-30',
    });
    await settle();

    // assert & verify
    expect(api.getNetWorthBreakdown).toHaveBeenCalledTimes(1);
    expect(lastRequest().measure).toBe('ASSETS');
  });
});
