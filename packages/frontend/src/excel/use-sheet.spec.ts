import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { workbookFromSheetData } from '@/sheet/workbook';

import { selectionRange, useSheet } from './use-sheet';

const workbook = () =>
  workbookFromSheetData({
    header: ['Year', 'Month', 'Region', 'Product', 'Quantity', 'Sales Amount'],
    rows: [
      [2026, 'Jan', 'North', 'Chain', 3, 90],
      [2026, 'Jan', 'North', 'Gloves', 2, 50],
    ],
    truncated: false,
  });

function setup() {
  return renderHook(() => useSheet(workbook()));
}

describe('useSheet', () => {
  it('Escape cancels an edit', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 3, row: 1 }));
    act(() => result.current.startEdit('Pump'));
    act(() => result.current.cancelEdit());
    expect(result.current.state.editing).toBeNull();
    expect(result.current.state.values.get('D2')).toBe('Chain');
  });

  it('Enter commits and moves down', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.startEdit('7'));
    act(() => result.current.commitEdit('Enter'));
    expect(result.current.state.values.get('E2')).toBe(7);
    expect(result.current.state.cursor).toEqual({ col: 4, row: 2 });
  });

  it('Tab commits and moves right', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.startEdit('7'));
    act(() => result.current.commitEdit('Tab'));
    expect(result.current.state.cursor).toEqual({ col: 5, row: 1 });
  });

  it('clicking away commits an edit', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.startEdit('9'));
    act(() => result.current.select({ col: 0, row: 0 }));
    expect(result.current.state.values.get('E2')).toBe(9);
    expect(result.current.state.editing).toBeNull();
  });

  it('typing a formula recalculates', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 6, row: 1 }));
    act(() => result.current.startEdit('=F2*2'));
    act(() => result.current.commitEdit());
    expect(result.current.state.values.get('G2')).toBe(180);
    act(() => result.current.select({ col: 5, row: 1 }));
    act(() => result.current.startEdit('100'));
    act(() => result.current.commitEdit());
    expect(result.current.state.values.get('G2')).toBe(200);
  });

  it('autoSum writes the SUM formula', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 5, row: 3 }));
    act(() => result.current.autoSum());
    expect(result.current.state.workbook.cells.get('F4')).toBe('=SUM(F2:F3)');
    expect(result.current.state.values.get('F4')).toBe(140);
  });

  it('sorts by the cursor column', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 5, row: 1 }));
    act(() => result.current.sort('asc'));
    expect(result.current.state.values.get('F2')).toBe(50);
    expect(result.current.state.values.get('D2')).toBe('Gloves');
  });

  it('clears the selection', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 3, row: 1 }));
    act(() => result.current.extendTo({ col: 5, row: 2 }));
    act(() => result.current.clearSelection());
    const { values } = result.current.state;
    for (const address of ['D2', 'E2', 'F2', 'D3', 'E3', 'F3']) expect(values.has(address)).toBe(false);
    expect(values.get('C2')).toBe('North');
    expect(values.get('D1')).toBe('Product');
  });

  it('extendTo keeps the active cell', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.extendTo({ col: 5, row: 2 }));
    expect(result.current.state.cursor).toEqual({ col: 4, row: 1 });
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 1, right: 5, bottom: 2 });
  });

  it('select collapses', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.extendTo({ col: 5, row: 2 }));
    act(() => result.current.select({ col: 0, row: 0 }));
    expect(selectionRange(result.current.state)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('shift+arrow extends', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.moveCursor('ArrowDown', true));
    act(() => result.current.moveCursor('ArrowDown', true));
    act(() => result.current.moveCursor('ArrowRight', true));
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 1, right: 5, bottom: 3 });
    expect(result.current.state.cursor).toEqual({ col: 4, row: 1 });
  });

  it('shift+arrow clamps at the edge', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 0, row: 0 }));
    act(() => result.current.moveCursor('ArrowUp', true));
    act(() => result.current.moveCursor('ArrowLeft', true));
    expect(selectionRange(result.current.state)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('plain arrow collapses', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.extendTo({ col: 5, row: 3 }));
    act(() => result.current.moveCursor('ArrowDown', false));
    expect(result.current.state.cursor).toEqual({ col: 4, row: 2 });
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 2, right: 4, bottom: 2 });
  });

  it('shift+Enter still moves up', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 2 }));
    act(() => result.current.moveCursor('Enter', true));
    expect(result.current.state.cursor).toEqual({ col: 4, row: 1 });
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 1, right: 4, bottom: 1 });
  });

  it('typing in a range edits the active cell only', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.extendTo({ col: 5, row: 2 }));
    act(() => result.current.startEdit('7'));
    act(() => result.current.commitEdit('Enter'));
    const { values, cursor } = result.current.state;
    expect(values.get('E2')).toBe(7);
    expect(values.get('F2')).toBe(90);
    expect(values.get('E3')).toBe(2);
    expect(values.get('F3')).toBe(50);
    expect(cursor).toEqual({ col: 4, row: 2 });
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 2, right: 4, bottom: 2 });
  });

  it('extendTo commits an open edit', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.startEdit('9'));
    act(() => result.current.extendTo({ col: 5, row: 2 }));
    expect(result.current.state.values.get('E2')).toBe(9);
    expect(result.current.state.editing).toBeNull();
  });

  it('load collapses', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 4, row: 1 }));
    act(() => result.current.extendTo({ col: 5, row: 2 }));
    act(() => result.current.load(workbook()));
    expect(selectionRange(result.current.state)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('resizeColumn stores a clamped width', () => {
    const { result } = setup();
    act(() => result.current.resizeColumn(1, 150));
    expect(result.current.state.columnWidths.get(1)).toBe(150);
    act(() => result.current.resizeColumn(1, 3));
    expect(result.current.state.columnWidths.get(1)).toBe(20);
  });

  it('load resets column widths', () => {
    const { result } = setup();
    act(() => result.current.resizeColumn(1, 150));
    act(() => result.current.load(workbook()));
    expect(result.current.state.columnWidths.size).toBe(0);
  });

  it('sort keeps column widths', () => {
    const { result } = setup();
    act(() => result.current.resizeColumn(1, 150));
    act(() => result.current.select({ col: 5, row: 1 }));
    act(() => result.current.sort('asc'));
    expect(result.current.state.columnWidths.get(1)).toBe(150);
  });

  it('fill copies the selection and selects the result', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 6, row: 1 }));
    act(() => result.current.startEdit('=F2*2'));
    act(() => result.current.commitEdit());
    act(() => result.current.select({ col: 6, row: 1 }));
    act(() => result.current.fill({ left: 6, top: 1, right: 6, bottom: 2 }));
    expect(result.current.state.values.get('G3')).toBe(100);
    expect(selectionRange(result.current.state)).toEqual({ left: 6, top: 1, right: 6, bottom: 2 });
    expect(result.current.state.cursor).toEqual({ col: 6, row: 1 });
  });

  it('fill upwards keeps the active cell', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 6, row: 2 }));
    act(() => result.current.startEdit('=1+1'));
    act(() => result.current.commitEdit());
    act(() => result.current.select({ col: 6, row: 2 }));
    act(() => result.current.fill({ left: 6, top: 1, right: 6, bottom: 2 }));
    expect(result.current.state.values.get('G2')).toBe(2);
    expect(result.current.state.cursor).toEqual({ col: 6, row: 2 });
    expect(selectionRange(result.current.state)).toEqual({ left: 6, top: 1, right: 6, bottom: 2 });
  });

  it('fill from a selection made bottom-up selects everything filled', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 5, row: 2 }));
    act(() => result.current.extendTo({ col: 4, row: 1 }));
    act(() => result.current.fill({ left: 4, top: 1, right: 5, bottom: 5 }));
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 1, right: 5, bottom: 5 });
    expect(result.current.state.cursor).toEqual({ col: 5, row: 1 });
    expect(result.current.state.values.get('F4')).toBe(90);
  });

  it('fill right from a selection made right-to-left selects everything filled', () => {
    const { result } = setup();
    act(() => result.current.select({ col: 5, row: 1 }));
    act(() => result.current.extendTo({ col: 4, row: 1 }));
    act(() => result.current.fill({ left: 4, top: 1, right: 7, bottom: 1 }));
    expect(selectionRange(result.current.state)).toEqual({ left: 4, top: 1, right: 7, bottom: 1 });
    expect(result.current.state.cursor).toEqual({ col: 4, row: 1 });
  });

  function pointingFrom(text: string) {
    const hook = setup();
    act(() => hook.result.current.select({ col: 6, row: 1 }));
    act(() => hook.result.current.startEdit(text));
    return hook;
  }

  it('pointAt inserts the clicked cell', () => {
    const { result } = pointingFrom('=');
    act(() => result.current.pointAt({ col: 5, row: 1 }, 1, false));
    expect(result.current.state.editing).toMatchObject({
      text: '=F2',
      caret: 3,
      point: { start: 1, end: 3, anchor: { col: 5, row: 1 } },
    });
  });

  it('pointTo drags out a range', () => {
    const { result } = pointingFrom('=');
    act(() => result.current.pointAt({ col: 5, row: 1 }, 1, false));
    act(() => result.current.pointTo({ col: 5, row: 3 }));
    expect(result.current.state.editing).toMatchObject({ text: '=F2:F4', caret: 6 });
  });

  it('pointAt again replaces the reference', () => {
    const { result } = pointingFrom('=');
    act(() => result.current.pointAt({ col: 5, row: 1 }, 1, false));
    act(() => result.current.pointAt({ col: 5, row: 2 }, 3, false));
    expect(result.current.state.editing?.text).toBe('=F3');
  });

  it('shift+pointAt makes a range from the pointed cell', () => {
    const { result } = pointingFrom('=');
    act(() => result.current.pointAt({ col: 5, row: 1 }, 1, false));
    act(() => result.current.pointAt({ col: 5, row: 3 }, 3, true));
    expect(result.current.state.editing?.text).toBe('=F2:F4');
  });

  it('typing after pointing keeps the caret where the user typed', () => {
    const { result } = pointingFrom('=');
    act(() => result.current.pointAt({ col: 5, row: 1 }, 1, false));
    act(() => result.current.changeEdit('=F2+'));
    expect(result.current.state.editing?.caret).toBeUndefined();
    expect(result.current.state.editing?.point).toBeUndefined();
  });

  it('pointAt does nothing when not editing', () => {
    const { result } = setup();
    const before = result.current.state.workbook;
    act(() => result.current.pointAt({ col: 5, row: 1 }, 1, false));
    expect(result.current.state.editing).toBeNull();
    expect(result.current.state.workbook).toBe(before);
  });
});
