import { describe, expect, it } from 'vitest';

import { readLinkFilters } from './link-filters';

const state = (filters: object) => ({ v: 1, source: 'sales_demo', filters });

describe('readLinkFilters', () => {
  it('reads filters from launch state', () => {
    expect(
      readLinkFilters(state({ region: ['North', 'South'], year: [2026] }), '')
    ).toEqual({
      kind: 'filters',
      source: 'deep-link',
      filters: { region: ['North', 'South'], year: [2026] },
    });
  });

  it('treats empty filters as nothing filtered, not as no state', () => {
    expect(readLinkFilters(state({}), '')).toEqual({
      kind: 'filters',
      source: 'deep-link',
      filters: {},
    });
  });

  it('reads filters from the query string when there is no launch state', () => {
    expect(
      readLinkFilters(
        undefined,
        '?source=sales_demo&region=South&region=North&year=2026&category=Bikes'
      )
    ).toEqual({
      kind: 'filters',
      source: 'query-string',
      filters: { region: ['North', 'South'], year: [2026], category: ['Bikes'] },
    });
  });

  it('returns none with neither', () => {
    expect(readLinkFilters(undefined, '?fabricEmbedded=true&_fu=x')).toEqual({
      kind: 'none',
    });
  });

  it('prefers launch state over the query string', () => {
    expect(
      readLinkFilters(state({ year: [2025] }), '?source=sales_demo&year=2026')
    ).toMatchObject({ source: 'deep-link', filters: { year: [2025] } });
  });

  it('invalid launch state does not fall back to the query string', () => {
    expect(readLinkFilters({ v: 2 }, '?source=sales_demo&year=2026').kind).toBe(
      'invalid'
    );
  });

  it('de-duplicates and sorts values', () => {
    expect(
      readLinkFilters(state({ region: ['South', 'North', 'South'] }), '')
    ).toMatchObject({ filters: { region: ['North', 'South'] } });
  });

  it.each([
    ['an unknown region', state({ region: ['Nowhere'] })],
    ['a year as a string', state({ year: ['2026'] })],
    ['a year outside the model', state({ year: [2030] })],
    ['an unknown filter key', state({ city: ['Miami'] })],
    ['the wrong source', { v: 1, source: 'other', filters: {} }],
    ['a non-object', 'v1.abc'],
  ])('rejects %s', (_label, input) => {
    expect(readLinkFilters(input, '').kind).toBe('invalid');
  });

  it('rejects an unknown value in the query string', () => {
    expect(readLinkFilters(undefined, '?source=sales_demo&category=Cars').kind).toBe(
      'invalid'
    );
  });

  it.each(['constructor', 'toString', '__proto__'])(
    'rejects the query-string key %s',
    (key) => {
      expect(readLinkFilters(undefined, `?source=sales_demo&${key}=x`).kind).toBe('invalid');
    }
  );

  it('rejects a __proto__ key in launch state', () => {
    expect(readLinkFilters(JSON.parse('{"v":1,"source":"sales_demo","filters":{"__proto__":["x"]}}'), '').kind).toBe('invalid');
  });
});
