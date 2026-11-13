import { buildPeriodParams, parsePeriodParams } from './period-url';

describe('period-url', () => {
  const now = new Date(2026, 10, 10);
  const fallback = { month: 10, year: 2026 };

  describe('parsePeriodParams', () => {
    it('should return null when there is no period, so the default applies', () => {
      // assert & verify
      expect(parsePeriodParams({}, now, fallback)).toBeNull();
    });

    it('should read each preset', () => {
      // assert & verify
      for (const preset of ['THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'LAST_YEAR'] as const) {
        expect(parsePeriodParams({ period: preset }, now, fallback)).toEqual({
          preset,
          ...fallback,
        });
      }
    });

    it('should read a custom month and year', () => {
      // act
      const result = parsePeriodParams(
        { period: 'CUSTOM', month: '3', year: '2022' },
        now,
        fallback,
      );

      // assert & verify
      expect(result).toEqual({ preset: 'CUSTOM', month: 3, year: 2022 });
    });

    it('should accept whole numbers as well as strings, as the builder produces them', () => {
      // assert & verify
      expect(parsePeriodParams({ period: 'CUSTOM', month: 8, year: 2026 }, now, fallback)).toEqual({
        preset: 'CUSTOM',
        month: 8,
        year: 2026,
      });
      expect(
        parsePeriodParams({ period: 'CUSTOM', month: 8.5, year: 2026 }, now, fallback),
      ).toBeNull();
    });

    it('should ignore an unknown preset', () => {
      // assert & verify
      expect(parsePeriodParams({ period: 'FOREVER' }, now, fallback)).toBeNull();
    });

    it('should ignore a custom period with a bad month', () => {
      // assert & verify
      for (const month of ['0', '13', 'x', '', '3.5']) {
        expect(
          parsePeriodParams({ period: 'CUSTOM', month, year: '2022' }, now, fallback),
        ).toBeNull();
      }
    });

    it('should ignore a custom period whose year is outside the offered range', () => {
      // assert & verify -- the dropdown offers five years back to one year ahead
      expect(
        parsePeriodParams({ period: 'CUSTOM', month: '3', year: '2020' }, now, fallback),
      ).toBeNull();
      expect(
        parsePeriodParams({ period: 'CUSTOM', month: '3', year: '2028' }, now, fallback),
      ).toBeNull();
      expect(
        parsePeriodParams({ period: 'CUSTOM', month: '3', year: '2021' }, now, fallback),
      ).not.toBeNull();
      expect(
        parsePeriodParams({ period: 'CUSTOM', month: '3', year: '2027' }, now, fallback),
      ).not.toBeNull();
    });

    it('should ignore a custom period with no month or year', () => {
      // assert & verify
      expect(parsePeriodParams({ period: 'CUSTOM' }, now, fallback)).toBeNull();
    });
  });

  describe('buildPeriodParams', () => {
    it('should leave the default Last Month out of the URL', () => {
      // assert & verify
      expect(buildPeriodParams('LAST_MONTH', 10, 2026)).toEqual({});
    });

    it('should write the other presets by name only', () => {
      // assert & verify
      expect(buildPeriodParams('THIS_YEAR', 10, 2026)).toEqual({ period: 'THIS_YEAR' });
      expect(buildPeriodParams('LAST_YEAR', 10, 2026)).toEqual({ period: 'LAST_YEAR' });
      expect(buildPeriodParams('THIS_MONTH', 10, 2026)).toEqual({ period: 'THIS_MONTH' });
    });

    it('should write the month and year for a custom period', () => {
      // assert & verify
      expect(buildPeriodParams('CUSTOM', 3, 2022)).toEqual({
        period: 'CUSTOM',
        month: 3,
        year: 2022,
      });
    });
  });
});
