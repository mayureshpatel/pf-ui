import { categoryCount, overLongNames, parseNames, preview } from './category-bulk';

describe('category-bulk', () => {
  describe('parseNames', () => {
    it('should trim each line and drop blank ones, whatever the line ending', () => {
      expect(parseNames('  Rent \r\n\n   \nWater\n')).toEqual(['Rent', 'Water']);
    });

    it('should return nothing for empty or missing text', () => {
      expect(parseNames('')).toEqual([]);
      expect(parseNames(null)).toEqual([]);
      expect(parseNames(undefined)).toEqual([]);
    });

    it('should keep duplicates, since the server reports them', () => {
      expect(parseNames('A\nA')).toEqual(['A', 'A']);
    });
  });

  describe('overLongNames', () => {
    it('should list only names beyond the limit', () => {
      expect(overLongNames(['ok', 'x'.repeat(50), 'y'.repeat(51)])).toEqual(['y'.repeat(51)]);
    });
  });

  it('should shorten long values for messages', () => {
    expect(preview('short')).toBe('short');
    expect(preview('z'.repeat(40))).toBe(`${'z'.repeat(30)}...`);
  });

  it('should use the singular for one category', () => {
    expect(categoryCount(1)).toBe('1 category');
    expect(categoryCount(0)).toBe('0 categories');
    expect(categoryCount(5)).toBe('5 categories');
  });
});
