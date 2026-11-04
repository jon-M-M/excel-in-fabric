import { describe, expect, it } from 'vitest';

import { toAddress } from './address';
import { evaluateFormula, isError, isFormula, isValidFormula, type CellValue } from './formula';

const cells: Record<string, CellValue> = {
  A1: 2,
  A2: 3,
  A3: 'x',
  A4: null,
  B1: '4',
  C1: { error: '#DIV/0!' },
};
const lookup = (col: number, row: number): CellValue => cells[toAddress(col, row)] ?? null;

describe('evaluateFormula', () => {
  it.each<[string, CellValue]>([
    ['=1+2*3', 7],
    ['=(1+2)*3', 9],
    ['=-A1+10', 8],
    ['=A1*A2', 6],
    ['=a1+$A$2', 5],
    ['=A4+1', 1],
    ['=B1+1', 5],
    ['=A3+1', { error: '#VALUE!' }],
    ['=1/0', { error: '#DIV/0!' }],
    ['=SUM(A1:A4)', 5],
    ['=sum(A1, A2, 10)', 15],
    ['=AVERAGE(A1:A2)', 2.5],
    ['=AVERAGE(A3:A4)', { error: '#DIV/0!' }],
    ['=MIN(A1:A2)', 2],
    ['=MAX(A1:A2)', 3],
    ['=COUNT(A1:A4)', 2],
    ['=SUM(A1:C1)', { error: '#DIV/0!' }],
    ['=C1+1', { error: '#DIV/0!' }],
    ['="hello"', 'hello'],
    ['=FOO(1)', { error: '#NAME?' }],
    ['=1+', { error: '#NAME?' }],
    ['=AA1', { error: '#REF!' }],
    ['=A1:A2', { error: '#VALUE!' }],
  ])('%s', (formula, expected) => {
    expect(evaluateFormula(formula, lookup)).toEqual(expected);
  });

  it('recognises formulas and errors', () => {
    expect(isFormula('=A1')).toBe(true);
    expect(isFormula('A1')).toBe(false);
    expect(isFormula(3)).toBe(false);
    expect(isError({ error: '#REF!' })).toBe(true);
    expect(isError(0)).toBe(false);
  });

  it('MIN and MAX work over a very large range', () => {
    const ones = () => 1;
    expect(evaluateFormula('=MIN(A1:Z10000)', ones)).toBe(1);
    expect(evaluateFormula('=MAX(A1:Z10000)', ones)).toBe(1);
  });

  it.each([
    ['=SUM(F2:F481)', true],
    ['="a"', true],
    ['=-A1*2', true],
    ['=1+', false],
    ['=SUM()', false],
    ['=', false],
    ['=(1', false],
  ])('isValidFormula(%s) is %s', (formula, expected) => {
    expect(isValidFormula(formula as string)).toBe(expected);
  });
});

describe('#REF! in formulas', () => {
  it('#REF! evaluates to the #REF! error', () => {
    expect(evaluateFormula('=#REF!+1', lookup)).toEqual({ error: '#REF!' });
    expect(evaluateFormula('=SUM(#REF!)', lookup)).toEqual({ error: '#REF!' });
  });

  it('#REF! is a valid formula for Excel', () => {
    expect(isValidFormula('=#REF!*2')).toBe(true);
  });
});
