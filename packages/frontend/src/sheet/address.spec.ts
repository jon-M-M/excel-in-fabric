import { describe, expect, it } from 'vitest';

import { columnLetter, parseAddress, toAddress } from './address';

describe('addresses', () => {
  it('names columns A to Z', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
  });

  it('builds an address from column and row', () => {
    expect(toAddress(0, 0)).toBe('A1');
    expect(toAddress(5, 480)).toBe('F481');
  });

  it('parses addresses, ignoring case and $', () => {
    expect(parseAddress('b12')).toEqual({ col: 1, row: 11 });
    expect(parseAddress('$B$12')).toEqual({ col: 1, row: 11 });
  });

  it.each(['AA1', 'A0', 'A', '1A', ''])('rejects %s', (text) => {
    expect(parseAddress(text)).toBeUndefined();
  });
});
