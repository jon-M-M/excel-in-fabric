import { describe, expect, it } from 'vitest';

import { findReferences, referenceColors, shiftReferences } from './references';

describe('shiftReferences', () => {
  it('shifts rows', () => {
    expect(shiftReferences('=A1+B2', 1, 0)).toBe('=A2+B3');
  });

  it('shifts columns', () => {
    expect(shiftReferences('=A1*2', 0, 2)).toBe('=C1*2');
  });

  it('keeps anchored parts', () => {
    expect(shiftReferences('=$A$1+A$1+$A1', 2, 1)).toBe('=$A$1+B$1+$A3');
  });

  it('leaves quoted text alone', () => {
    expect(shiftReferences('="A1"&A1', 1, 0)).toBe('="A1"&A2');
  });

  it('off the top becomes #REF!', () => {
    expect(shiftReferences('=A1+B5', -1, 0)).toBe('=#REF!+B4');
  });

  it('off the sides becomes #REF!', () => {
    expect(shiftReferences('=A1', 0, -1)).toBe('=#REF!');
    expect(shiftReferences('=Z1', 0, 1)).toBe('=#REF!');
  });

  it('shifts ranges', () => {
    expect(shiftReferences('=SUM(A1:A3)', 1, 0)).toBe('=SUM(A2:A4)');
    expect(shiftReferences('=SUM(A1:A3)', -1, 0)).toBe('=SUM(#REF!)');
  });

  it('leaves function names alone', () => {
    expect(shiftReferences('=MAX(A1,B1)', 1, 0)).toBe('=MAX(A2,B2)');
  });

  it("keeps the letter's case", () => {
    expect(shiftReferences('=a1', 1, 0)).toBe('=a2');
  });
});

describe('findReferences', () => {
  it('finds references and ranges', () => {
    const a1 = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(findReferences('=A1+SUM(B2:C3)+a1')).toEqual([
      { start: 1, end: 3, range: a1 },
      { start: 8, end: 13, range: { left: 1, top: 1, right: 2, bottom: 2 } },
      { start: 15, end: 17, range: a1 },
    ]);
  });

  it('skips quoted text', () => {
    expect(findReferences('="A1"&B1')).toEqual([{ start: 6, end: 8, range: { left: 1, top: 0, right: 1, bottom: 0 } }]);
  });
});

describe('referenceColors', () => {
  it('shares a colour for the same cells', () => {
    expect(referenceColors(findReferences('=A1+$A$1+B2'))).toEqual([0, 0, 1]);
  });
});
