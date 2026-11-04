import { describe, expect, it } from 'vitest';

import { buildSalesQuery } from './sales-query';

describe('buildSalesQuery', () => {
  it('filters by every present key in contract order', () => {
    const q = buildSalesQuery({ category: ['Bikes'], region: ['North', 'South'], year: [2026] });
    expect(q).toContain(`TREATAS({"North", "South"}, 'Region'[Region])`);
    expect(q).toContain(`TREATAS({2026}, 'Date'[Year])`);
    expect(q).toContain(`TREATAS({"Bikes"}, 'Product'[Category])`);
    expect(q.indexOf("TREATAS({\"North\"")).toBeLessThan(q.indexOf('TREATAS({2026}'));
    expect(q.indexOf('TREATAS({2026}')).toBeLessThan(q.indexOf('TREATAS({"Bikes"}'));
  });

  it('has no filters for an empty filter set', () => {
    expect(buildSalesQuery({})).not.toContain('TREATAS');
  });

  it('escapes quotes in string values', () => {
    expect(buildSalesQuery({ region: ['A"B'] })).toContain(`{"A""B"}`);
  });

  it('orders by year, month number, region, product', () => {
    expect(buildSalesQuery({})).toMatch(
      /ORDER BY \[Year\], \[Month Number\], \[Region\], \[Product\]\s*$/
    );
  });
});
