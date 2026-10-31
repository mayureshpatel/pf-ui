import {
  defaultNetWorthState,
  fromNetWorthParams,
  NetWorthState,
  toBreakdownParams,
  toNetWorthParams,
} from './net-worth-state';

const TODAY = new Date(2026, 9, 25);

describe('net-worth-state (PF-887)', () => {
  const base = (): NetWorthState => defaultNetWorthState(TODAY);

  describe('defaultNetWorthState', () => {
    it('should start on the last 12 months, net worth, not comparing, nothing filtered or drilled', () => {
      // assert & verify
      expect(base()).toEqual({
        measure: 'NET_WORTH',
        startDate: '2025-10-26',
        endDate: '2026-10-25',
        rangeLabel: 'Last 12 months',
        compare: 'NONE',
        accountIds: [],
        typeCode: null,
        accountId: null,
        month: null,
      });
    });
  });

  describe('URL round trip', () => {
    it('should round-trip every field', () => {
      // arrange
      const state: NetWorthState = {
        measure: 'DEBTS',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        rangeLabel: 'Custom',
        compare: 'YEAR_AGO',
        accountIds: [3, 4],
        typeCode: 'SAVINGS',
        accountId: 4,
        month: '2026-03',
      };

      // act
      const { state: back, note } = fromNetWorthParams(toNetWorthParams(state), TODAY);

      // assert & verify
      expect(back).toEqual(state);
      expect(note).toBeNull();
    });

    it('should leave the default measure, comparison and empty lists out of the URL', () => {
      // act
      const params = toNetWorthParams(base());

      // assert & verify
      expect(params['nwMeasure']).toBeUndefined();
      expect(params['nwCompare']).toBeUndefined();
      expect(params['nwAccounts']).toBeUndefined();
      expect(params['nwType']).toBeUndefined();
      expect(params['nwAccount']).toBeUndefined();
      expect(params['nwMonth']).toBeUndefined();
      expect(params['nwStart']).toBe('2025-10-26');
      expect(params['nwEnd']).toBe('2026-10-25');
    });

    it('should read a bare link as the default state with no note', () => {
      // act
      const { state, note } = fromNetWorthParams({}, TODAY);

      // assert & verify
      expect(state).toEqual(base());
      expect(note).toBeNull();
    });
  });

  describe('invalid links', () => {
    it('should fall back with a note for an unknown measure or comparison', () => {
      // act
      const { state, note } = fromNetWorthParams({ nwMeasure: 'NOPE', nwCompare: 'NOPE' }, TODAY);

      // assert & verify
      expect(state.measure).toBe('NET_WORTH');
      expect(state.compare).toBe('NONE');
      expect(note).toContain("couldn't be used");
    });

    it('should fall back to the default range for a reversed or malformed range', () => {
      // act
      const reversed = fromNetWorthParams({ nwStart: '2026-06-30', nwEnd: '2026-01-01' }, TODAY);
      const malformed = fromNetWorthParams({ nwStart: 'last tuesday', nwEnd: '2026-01-01' }, TODAY);

      // assert & verify
      expect(reversed.state.startDate).toBe('2025-10-26');
      expect(reversed.note).toContain("dates weren't valid");
      expect(malformed.state.endDate).toBe('2026-10-25');
    });

    it('should drop a month that is outside the range', () => {
      // act
      const { state, note } = fromNetWorthParams({ nwMonth: '2020-01' }, TODAY);

      // assert & verify
      expect(state.month).toBeNull();
      expect(note).toContain("couldn't be used");
    });

    it('should drop non-numeric account ids', () => {
      // act
      const { state } = fromNetWorthParams({ nwAccounts: '3,x,5' }, TODAY);

      // assert & verify
      expect(state.accountIds).toEqual([3, 5]);
    });

    it('should drop a drilled account that the account filter excludes', () => {
      // act
      const { state, note } = fromNetWorthParams({ nwAccounts: '3,4', nwAccount: '9' }, TODAY);

      // assert & verify
      expect(state.accountId).toBeNull();
      expect(note).toContain("couldn't be used");
    });

    it('should keep a drilled account when no account filter is set', () => {
      // act
      const { state } = fromNetWorthParams({ nwAccount: '9' }, TODAY);

      // assert & verify
      expect(state.accountId).toBe(9);
    });
  });

  describe('toBreakdownParams', () => {
    it('should group by type until a type or account is drilled, then by account', () => {
      // assert & verify
      expect(toBreakdownParams(base())['groupBy']).toBe('TYPE');
      expect(toBreakdownParams({ ...base(), typeCode: 'SAVINGS' })['groupBy']).toBe('ACCOUNT');
      expect(toBreakdownParams({ ...base(), accountId: 9 })['groupBy']).toBe('ACCOUNT');
    });

    it('should send the range, filters, comparison and month by their API names', () => {
      // arrange
      const state: NetWorthState = {
        ...base(),
        compare: 'PREVIOUS_PERIOD',
        accountIds: [3, 4],
        typeCode: 'SAVINGS',
        month: '2026-03',
      };

      // act
      const params = toBreakdownParams(state);

      // assert & verify
      expect(params).toEqual({
        startDate: '2025-10-26',
        endDate: '2026-10-25',
        groupBy: 'ACCOUNT',
        accountIds: '3,4',
        typeCode: 'SAVINGS',
        compare: 'PREVIOUS_PERIOD',
        asOf: '2026-03',
      });
    });

    it('should leave out the comparison, the month and empty filters', () => {
      // act
      const params = toBreakdownParams(base());

      // assert & verify
      expect(Object.keys(params).sort()).toEqual(['endDate', 'groupBy', 'startDate']);
    });
  });
});
