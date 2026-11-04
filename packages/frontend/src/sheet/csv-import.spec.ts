import { describe, expect, it } from 'vitest';

import { csvWorkbookName, parseCsv } from './csv-import';

function loaded(text: string) {
  const result = parseCsv(text);
  if (result.kind !== 'loaded') throw new Error(`expected loaded, got ${result.kind}`);
  return result;
}

describe('parseCsv', () => {
  it('reads a header and numeric rows', () => {
    const { data } = loaded('Region,Sales\nNorth,100\nSouth,200\n');
    expect(data.header).toEqual(['Region', 'Sales']);
    expect(data.rows).toEqual([
      ['North', 100],
      ['South', 200],
    ]);
    expect(data.truncated).toBe(false);
  });

  it('parses quotes, CRLF, BOM and a trailing newline', () => {
    const { data } = loaded(String.fromCharCode(0xfeff) + 'Name,Note\r\n"Smith, J","said ""hi"""\r\n\r\n');
    expect(data.header).toEqual(['Name', 'Note']);
    expect(data.rows).toEqual([['Smith, J', 'said "hi"']]);
  });

  it('keeps leading zeros as text', () => {
    expect(loaded('Code\n00123\n').data.rows).toEqual([['00123']]);
  });

  it('reads negative and exponent numbers', () => {
    expect(loaded('N\n-12.5\n1e3\n').data.rows).toEqual([[-12.5], [1000]]);
  });

  it('pads short rows', () => {
    expect(loaded('A,B,C\n1\n').data.rows).toEqual([[1, null, null]]);
  });

  it('keeps columns A to Z and says so', () => {
    const header = Array.from({ length: 30 }, (_, i) => `C${i}`).join(',');
    const row = Array.from({ length: 30 }, (_, i) => i).join(',');
    const result = loaded(`${header}\n${row}\n`);
    expect(result.data.header).toHaveLength(26);
    expect(result.data.rows[0]).toHaveLength(26);
    expect(result.droppedColumns).toBe(4);
  });

  it('caps rows at 5000', () => {
    const text = 'N\n' + Array.from({ length: 5001 }, (_, i) => i).join('\n');
    const { data } = loaded(text);
    expect(data.rows).toHaveLength(5000);
    expect(data.truncated).toBe(true);
  });

  it('returns empty for an empty file', () => {
    expect(parseCsv('')).toEqual({ kind: 'empty' });
    expect(parseCsv('\n\n')).toEqual({ kind: 'empty' });
  });

  it('rejects a file that is not text', () => {
    const nul = String.fromCharCode(0);
    expect(parseCsv(`a,b${nul}${nul}c
1,2`).kind).toBe('invalid');
    expect(parseCsv('PK' + String.fromCharCode(3, 4) + 'rest of a zip').kind).toBe('invalid');
  });
});

describe('csvWorkbookName', () => {
  it('names the workbook after the file', () => {
    expect(csvWorkbookName('Sales Export.csv')).toBe('Sales Export');
    expect(csvWorkbookName('data')).toBe('data');
  });
});
