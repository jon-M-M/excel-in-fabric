import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { setCell, workbookFromSheetData, type Workbook } from '@/sheet/workbook';

import { FormulaBar } from './FormulaBar';
import { Grid } from './Grid';
import { referenceColor } from './reference-colors';
import { useSheet } from './use-sheet';

function workbook(rows = 3): Workbook {
  return workbookFromSheetData({
    header: ['Year', 'Month', 'Region', 'Product', 'Quantity', 'Sales Amount'],
    rows: Array.from({ length: rows }, (_, i) => [2026, 'Jan', 'North', `P${i}`, 1, 30 - i * 10]),
    truncated: false,
  });
}

function Harness({
  initial,
  widths = {},
  measureText,
}: {
  initial: Workbook;
  widths?: Record<number, number>;
  measureText?: (text: string) => number;
}) {
  const sheet = useSheet(initial);
  useEffect(() => {
    for (const [col, width] of Object.entries(widths)) sheet.resizeColumn(Number(col), width);
    // Only the starting widths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <FormulaBar sheet={sheet} />
      <Grid sheet={sheet} viewportHeight={400} measureText={measureText} />
    </>
  );
}

const cell = (address: string) => screen.getByRole('gridcell', { name: address });
const editor = () => screen.getByRole('textbox', { name: 'Cell editor' });
const header = (letter: string) => screen.getByRole('columnheader', { name: letter });
const resizer = (letter: string) => screen.getByRole('separator', { name: `Resize column ${letter}` });

function dragEdge(letter: string, from: number, to: number) {
  fireEvent.mouseDown(resizer(letter), { clientX: from });
  fireEvent.mouseMove(window, { clientX: to, buttons: 1 });
  fireEvent.mouseUp(window);
}
const selected = () =>
  screen
    .getAllByRole('gridcell')
    .filter((c) => c.getAttribute('aria-selected') === 'true')
    .map((c) => c.getAttribute('aria-label'));

function drag(from: string, to: string) {
  fireEvent.mouseDown(cell(from));
  fireEvent.mouseEnter(cell(to), { buttons: 1 });
  fireEvent.mouseUp(window);
}

describe('Grid', () => {
  it('renders column letters A to Z', () => {
    render(<Harness initial={workbook()} />);
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Z' })).toBeInTheDocument();
  });

  it('renders only visible rows', () => {
    render(<Harness initial={workbook(5000)} />);
    expect(screen.getAllByRole('row').length).toBeLessThan(60);
  });

  it('typing into a cell edits it', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('A2'));
    fireEvent.keyDown(screen.getByRole('grid'), { key: '5' });
    const input = editor();
    expect(input).toHaveValue('5');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(cell('A2')).toHaveTextContent('5');
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('A3');
  });

  it('the formula bar shows the raw formula', () => {
    const { result } = renderHook(() => setCell(workbook(), 6, 1, '=F2*2'));
    render(<Harness initial={result.current} />);
    fireEvent.click(cell('G2'));
    expect(screen.getByLabelText('Formula Bar')).toHaveValue('=F2*2');
    expect(cell('G2')).toHaveTextContent('60');
  });

  it('Escape cancels an edit', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('D2'));
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'x' });
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(cell('D2')).toHaveTextContent('P0');
  });

  it('clicking a column letter sorts', () => {
    render(<Harness initial={workbook()} />);
    const amounts = () => ['F2', 'F3', 'F4'].map((a) => cell(a).textContent);
    fireEvent.click(screen.getByRole('columnheader', { name: 'F' }));
    expect(amounts()).toEqual(['10', '20', '30']);
    fireEvent.click(screen.getByRole('columnheader', { name: 'F' }));
    expect(amounts()).toEqual(['30', '20', '10']);
  });

  it('leaving the formula bar commits the edit', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('G2'));
    const bar = screen.getByLabelText('Formula Bar');
    fireEvent.focus(bar);
    fireEvent.change(bar, { target: { value: '=1+1' } });
    fireEvent.blur(bar);
    expect(cell('G2')).toHaveTextContent('2');
    fireEvent.keyDown(screen.getByRole('grid'), { key: '7' });
    expect(editor()).toHaveValue('7');
  });

  it('dragging selects a range', () => {
    render(<Harness initial={workbook()} />);
    drag('A2', 'C3');
    for (const a of ['A2', 'B2', 'C2', 'A3', 'B3', 'C3']) expect(cell(a)).toHaveAttribute('aria-selected', 'true');
    for (const a of ['D2', 'A4']) expect(cell(a)).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('A2');
    expect(screen.getByTestId('selection-box')).toBeInTheDocument();
  });

  it('a drag ends on release anywhere', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.mouseDown(cell('A2'));
    fireEvent.mouseEnter(cell('B2'), { buttons: 1 });
    fireEvent.mouseUp(window);
    fireEvent.mouseEnter(cell('D4'), { buttons: 1 });
    expect(selected()).toEqual(['A2', 'B2']);
  });

  it('entering a cell with no button pressed does not extend', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.mouseDown(cell('A2'));
    fireEvent.mouseEnter(cell('C3'), { buttons: 0 });
    fireEvent.mouseEnter(cell('C4'), { buttons: 1 });
    expect(selected()).toEqual(['A2']);
  });

  it('shift+click extends from the active cell', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.mouseDown(cell('B2'));
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(cell('D4'), { shiftKey: true });
    fireEvent.mouseUp(window);
    expect(selected()).toHaveLength(9);
    expect(cell('D4')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('B2');
  });

  it('Delete clears the range', () => {
    render(<Harness initial={workbook()} />);
    drag('A2', 'B3');
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'Delete' });
    for (const a of ['A2', 'B2', 'A3', 'B3']) expect(cell(a)).toHaveTextContent('');
    expect(cell('C2')).toHaveTextContent('North');
  });

  it('clicking a column letter after a range sorts and collapses', () => {
    render(<Harness initial={workbook()} />);
    drag('D2', 'F3');
    fireEvent.click(screen.getByRole('columnheader', { name: 'F' }));
    expect(['F2', 'F3', 'F4'].map((a) => cell(a).textContent)).toEqual(['10', '20', '30']);
    expect(selected()).toEqual(['F2']);
    expect(screen.queryByTestId('selection-box')).not.toBeInTheDocument();
  });

  it('one cell shows no selection box', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('B2'));
    expect(screen.queryByTestId('selection-box')).not.toBeInTheDocument();
  });

  it('selected headers are highlighted', () => {
    render(<Harness initial={workbook()} />);
    drag('B2', 'C3');
    const column = (name: string) => screen.getByRole('columnheader', { name });
    const row = (name: string) => screen.getByRole('rowheader', { name });
    for (const h of [column('B'), column('C'), row('2'), row('3')]) expect(h).toHaveClass('xl-active-header');
    for (const h of [column('D'), row('4')]) expect(h).not.toHaveClass('xl-active-header');
  });

  it('typing with the active cell scrolled away brings it back into view', () => {
    render(<Harness initial={workbook(200)} />);
    fireEvent.click(cell('A2'));
    const grid = screen.getByRole('grid');
    grid.scrollTop = 3000;
    fireEvent.scroll(grid);
    expect(screen.queryByRole('gridcell', { name: 'A2' })).not.toBeInTheDocument();
    fireEvent.keyDown(grid, { key: '5' });
    expect(editor()).toHaveValue('5');
  });

  it('a drag ends when the window loses focus', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.mouseDown(cell('A2'));
    fireEvent.mouseEnter(cell('B2'), { buttons: 1 });
    fireEvent.blur(window);
    fireEvent.mouseEnter(cell('D4'), { buttons: 1 });
    expect(selected()).toEqual(['A2', 'B2']);
  });

  it('columns render at their set widths', () => {
    render(<Harness initial={workbook()} widths={{ 1: 150 }} />);
    expect(screen.getByRole('columnheader', { name: 'B' }).style.width).toBe('150px');
    expect(cell('B2').style.width).toBe('150px');
    expect(screen.getByRole('columnheader', { name: 'C' }).style.width).toBe('96px');
  });

  it('dragging a column edge resizes it', () => {
    render(<Harness initial={workbook()} />);
    dragEdge('B', 100, 150);
    expect(header('B').style.width).toBe('146px');
    expect(cell('B2').style.width).toBe('146px');
  });

  it('width clamps at the minimum', () => {
    render(<Harness initial={workbook()} />);
    dragEdge('B', 500, 0);
    expect(header('B').style.width).toBe('20px');
  });

  it('resizing never sorts', () => {
    render(<Harness initial={workbook()} />);
    const amounts = () => ['F2', 'F3', 'F4'].map((a) => cell(a).textContent);
    dragEdge('F', 100, 80);
    fireEvent.click(header('F'));
    expect(amounts()).toEqual(['30', '20', '10']);
    fireEvent.mouseDown(header('F'));
    fireEvent.click(header('F'));
    expect(amounts()).toEqual(['10', '20', '30']);
  });

  it('double-clicking a column edge auto-fits', () => {
    render(<Harness initial={workbook()} measureText={(t) => t.length * 7} />);
    fireEvent.doubleClick(resizer('D'));
    expect(header('D').style.width).toBe('57px');
    expect(cell('D2')).toHaveTextContent('P0');
  });

  it('selection box follows resized columns', () => {
    render(<Harness initial={workbook()} />);
    drag('B2', 'C3');
    dragEdge('B', 100, 150);
    const box = screen.getByTestId('selection-box');
    expect(box.style.left).toBe('144px');
    expect(box.style.width).toBe('242px');
  });

  it('the fill handle sits at the selection corner', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('B2'));
    const handle = () => screen.getByTestId('fill-handle');
    expect(handle().style.left).toBe('236px');
    expect(handle().style.top).toBe('56px');
    drag('B2', 'C3');
    expect(handle().style.left).toBe('332px');
    expect(handle().style.top).toBe('76px');
  });

  it('no fill handle while editing', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('B2'));
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'x' });
    expect(screen.queryByTestId('fill-handle')).not.toBeInTheDocument();
  });

  it('dragging the fill handle copies a formula down', () => {
    render(<Harness initial={setCell(workbook(), 6, 1, '=F2*2')} />);
    fireEvent.click(cell('G2'));
    fireEvent.mouseDown(screen.getByTestId('fill-handle'));
    fireEvent.mouseEnter(cell('G4'), { buttons: 1 });
    expect(screen.getByTestId('fill-outline')).toBeInTheDocument();
    fireEvent.mouseUp(window);
    expect(cell('G3')).toHaveTextContent('40');
    expect(cell('G4')).toHaveTextContent('20');
    expect(screen.queryByTestId('fill-outline')).not.toBeInTheDocument();
    expect(selected()).toEqual(['G2', 'G3', 'G4']);
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('G2');
  });

  it('a fill cancelled by losing focus changes nothing', () => {
    render(<Harness initial={setCell(workbook(), 6, 1, '=F2*2')} />);
    fireEvent.click(cell('G2'));
    fireEvent.mouseDown(screen.getByTestId('fill-handle'));
    fireEvent.mouseEnter(cell('G4'), { buttons: 1 });
    fireEvent.blur(window);
    expect(cell('G3')).toHaveTextContent('');
    expect(cell('G4')).toHaveTextContent('');
    expect(screen.queryByTestId('fill-outline')).not.toBeInTheDocument();
  });

  it('releasing inside the selection fills nothing', () => {
    render(<Harness initial={setCell(workbook(), 6, 1, '=F2*2')} />);
    fireEvent.click(cell('G2'));
    fireEvent.mouseDown(screen.getByTestId('fill-handle'));
    fireEvent.mouseEnter(cell('G2'), { buttons: 1 });
    fireEvent.mouseUp(window);
    expect(cell('G3')).toHaveTextContent('');
  });

  it('double-clicking the fill handle fills down beside the data', () => {
    render(<Harness initial={setCell(workbook(), 6, 1, '=F2*2')} />);
    fireEvent.click(cell('G2'));
    fireEvent.doubleClick(screen.getByTestId('fill-handle'));
    expect(cell('G3')).toHaveTextContent('40');
    expect(cell('G4')).toHaveTextContent('20');
    expect(cell('G5')).toHaveTextContent('');
  });

  it('pressing the fill handle does not change the selection', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('G2'));
    fireEvent.mouseDown(screen.getByTestId('fill-handle'));
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('G2');
    expect(selected()).toEqual(['G2']);
    fireEvent.mouseUp(window);
  });

  it('filling does not scroll the grid', () => {
    render(<Harness initial={setCell(workbook(200), 6, 1, '=F2*2')} />);
    fireEvent.click(cell('G2'));
    fireEvent.doubleClick(screen.getByTestId('fill-handle'));
    expect(screen.getByRole('grid').scrollTop).toBe(0);
    expect(cell('G3')).toHaveTextContent('40');
  });

  it('the cell editor survives scrolling away', () => {
    render(<Harness initial={workbook(200)} />);
    fireEvent.click(cell('A2'));
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: '=' });
    grid.scrollTop = 3000;
    fireEvent.scroll(grid);
    expect(screen.queryByRole('gridcell', { name: 'A2' })).not.toBeInTheDocument();
    expect(editor()).toHaveValue('=');
    expect(document.activeElement).toBe(editor());
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Cell editor' })).not.toBeInTheDocument();
  });

  function startFormula(text = '=') {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('G2'));
    fireEvent.keyDown(screen.getByRole('grid'), { key: '=' });
    if (text !== '=') fireEvent.change(editor(), { target: { value: text } });
  }

  // As a browser does: press, release, then a click on the same cell.
  function clickCell(address: string, options: object = {}) {
    fireEvent.mouseDown(cell(address), options);
    fireEvent.mouseUp(window);
    fireEvent.click(cell(address), options);
  }

  it('clicking a cell after = inserts its address', () => {
    startFormula();
    clickCell('F2');
    expect(editor()).toHaveValue('=F2');
    expect(document.activeElement).toBe(editor());
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('G2');
  });

  it('dragging inserts a range', () => {
    startFormula('=SUM(');
    fireEvent.mouseDown(cell('F2'));
    fireEvent.mouseEnter(cell('F4'), { buttons: 1 });
    fireEvent.mouseUp(window);
    expect(editor()).toHaveValue('=SUM(F2:F4');
  });

  it('clicking another cell replaces the pointed reference', () => {
    startFormula();
    clickCell('F2');
    clickCell('F3');
    expect(editor()).toHaveValue('=F3');
  });

  it('shift+click makes a range from the pointed reference', () => {
    startFormula();
    clickCell('F2');
    clickCell('F4', { shiftKey: true });
    expect(editor()).toHaveValue('=F2:F4');
  });

  it('after an operator a click adds another reference', () => {
    startFormula();
    clickCell('F2');
    fireEvent.change(editor(), { target: { value: '=F2+' } });
    clickCell('F3');
    expect(editor()).toHaveValue('=F2+F3');
  });

  it('clicking when the formula is complete commits instead', () => {
    startFormula('=F2');
    clickCell('F3');
    expect(screen.queryByRole('textbox', { name: 'Cell editor' })).not.toBeInTheDocument();
    expect(cell('G2')).toHaveTextContent('30');
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('F3');
  });

  it('Enter after pointing commits the formula', () => {
    startFormula();
    clickCell('F2');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(cell('G2')).toHaveTextContent('30');
  });

  it('the editing cell itself is not inserted', () => {
    startFormula();
    fireEvent.mouseDown(cell('G2'));
    expect(editor()).toHaveValue('=');
  });

  it('point mode works from the formula bar', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('G2'));
    const bar = screen.getByLabelText('Formula Bar');
    bar.focus();
    fireEvent.focus(bar);
    fireEvent.change(bar, { target: { value: '=' } });
    clickCell('F2');
    expect(bar).toHaveValue('=F2');
    expect(cell('G2')).toHaveTextContent('=F2');
  });

  it('a point drag ends on window blur', () => {
    startFormula();
    fireEvent.mouseDown(cell('F2'));
    fireEvent.mouseEnter(cell('F3'), { buttons: 1 });
    fireEvent.blur(window);
    fireEvent.mouseEnter(cell('F5'), { buttons: 1 });
    expect(editor()).toHaveValue('=F2:F3');
  });

  it('references get coloured boxes while editing', () => {
    startFormula('=F2+SUM(F3:F4)+F2');
    const boxes = screen.getAllByTestId('ref-box');
    expect(boxes).toHaveLength(2);
    expect([boxes[0].style.left, boxes[0].style.top, boxes[0].style.width, boxes[0].style.height]).toEqual([
      '528px',
      '40px',
      '96px',
      '20px',
    ]);
    expect([boxes[1].style.top, boxes[1].style.height]).toEqual(['60px', '40px']);
    const colour = (box: HTMLElement) => box.style.borderColor;
    const probe = document.createElement('div');
    const css = (hex: string) => ((probe.style.borderColor = hex), probe.style.borderColor);
    expect(colour(boxes[0])).toBe(css(referenceColor(0)));
    expect(colour(boxes[1])).toBe(css(referenceColor(1)));
  });

  it('the boxes go when the edit ends', () => {
    startFormula('=F2');
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByTestId('ref-box')).not.toBeInTheDocument();
  });

  it('plain text gets no boxes', () => {
    render(<Harness initial={workbook()} />);
    fireEvent.click(cell('G2'));
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'x' });
    fireEvent.change(editor(), { target: { value: 'F2' } });
    expect(screen.queryByTestId('ref-box')).not.toBeInTheDocument();
  });

  it('the cell under the editor does not show the text a second time', () => {
    startFormula('=SUM(F2:F10)+F12');
    expect(cell('G2')).toHaveTextContent('');
    expect(editor()).toHaveValue('=SUM(F2:F10)+F12');
  });

  it('a point drag updates the formula at once, before the next keystroke', () => {
    startFormula('=SUM(');
    fireEvent.mouseDown(cell('F2'));
    // Native events outside act(), as a browser sends them; React builds mouseenter from the mouseout of the cell
    // being left, treats it as low priority and may defer the render.
    cell('F2').dispatchEvent(new MouseEvent('mouseout', { bubbles: true, buttons: 1, relatedTarget: cell('F4') }));
    cell('F4').dispatchEvent(new MouseEvent('mouseover', { bubbles: true, buttons: 1, relatedTarget: cell('F2') }));
    expect(editor()).toHaveValue('=SUM(F2:F4');
    fireEvent.mouseUp(window);
  });

  it('double-clicking a cell while pointing keeps the formula', () => {
    startFormula('=SUM(');
    clickCell('F2');
    clickCell('F2');
    fireEvent.doubleClick(cell('F2'));
    expect(editor()).toHaveValue('=SUM(F2');
    expect(screen.getByLabelText('Name Box')).toHaveTextContent('G2');
  });

  it('pointing with text selected in the editor replaces the selection', () => {
    startFormula('=A1+B1');
    (editor() as HTMLInputElement).setSelectionRange(4, 6);
    clickCell('F3');
    expect(editor()).toHaveValue('=A1+F3');
  });

  it('if the grid takes focus while editing in the cell (e.g. its scrollbar is pressed), the editor gets it back', () => {
    startFormula('=SUM(');
    act(() => screen.getByRole('grid').focus());
    expect(document.activeElement).toBe(editor());
  });

  it('when not editing the grid keeps focus', () => {
    render(<Harness initial={workbook()} />);
    const grid = screen.getByRole('grid');
    act(() => grid.focus());
    expect(document.activeElement).toBe(grid);
  });
});
