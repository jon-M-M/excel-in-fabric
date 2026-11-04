// The cell grid: column letters, row numbers, cells and the selection, with only the visible rows in the DOM.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

import { COLUMN_COUNT, columnLetter, toAddress } from '@/sheet/address';
import { fillDownExtent, fillExtent } from '@/sheet/fill';
import { isError, isFormula } from '@/sheet/formula';
import { canPoint } from '@/sheet/point-mode';
import { findReferences, referenceColors } from '@/sheet/references';
import type { Cursor, MoveKey } from '@/sheet/navigation';
import { inRange, isSingleCell, type CellRange } from '@/sheet/selection';
import { displayText, rawText } from '@/sheet/workbook';

import { FormulaInput } from './FormulaInput';
import { referenceColor } from './reference-colors';
import { autoFitWidth, columnLeft, columnWidth, ROW_HEADER_WIDTH, ROW_HEIGHT } from './grid-geometry';
import { selectionRange, type Sheet } from './use-sheet';
import { startWindowDrag } from './window-drag';

export const OVERSCAN = 10;
const MOVE_KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab']);
const COLUMNS = Array.from({ length: COLUMN_COUNT }, (_, c) => c);

// Same font as .xl-cell, for auto-fitting a column to its text.
const CELL_FONT = "14px 'Aptos Narrow', 'Segoe UI', 'Arial Narrow', sans-serif";
let textContext: CanvasRenderingContext2D | null | undefined;

// Created on the first auto-fit only.
function measureCellText(text: string): number {
  if (textContext === undefined) {
    textContext = document.createElement('canvas').getContext('2d');
    if (textContext) textContext.font = CELL_FONT;
  }
  return textContext ? textContext.measureText(text).width : text.length * 7;
}

export function Grid({
  sheet,
  viewportHeight,
  measureText = measureCellText,
}: {
  sheet: Sheet;
  viewportHeight?: number;
  measureText?: (text: string) => number;
}) {
  const { workbook, values, cursor, focus, editing, columnWidths } = sheet.state;
  const range = selectionRange(sheet.state);
  const single = isSingleCell(range);
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measured, setMeasured] = useState(600);
  const [lastSort, setLastSort] = useState<{ col: number; direction: 'asc' | 'desc' } | null>(null);
  const height = viewportHeight ?? measured;
  // A mouse drag selecting a range; a ref, so entering cells doesn't re-render for it.
  const dragging = useRef(false);
  const endDragRef = useRef<() => void>(() => {});
  // A fill-handle drag: the cell the pointer is over (state draws the outline; the ref is read on release).
  const fillDragging = useRef(false);
  const fillTargetRef = useRef<Cursor | null>(null);
  const [fillTarget, setFillTarget] = useState<Cursor | null>(null);
  // A point-mode drag (typing a range into a formula), and the click a browser sends after a point press,
  // which must not select the cell and end the edit.
  const pointDragging = useRef(false);
  const pointedClick = useRef(false);
  // Set by a fill so the view stays where it is, as in Excel; cleared after every render.
  const holdScroll = useRef(false);
  // Set when a column-edge press starts, so the click a browser sends to the letter afterwards doesn't sort.
  const resizedColumn = useRef(false);

  useLayoutEffect(() => {
    const element = gridRef.current;
    if (!element || viewportHeight !== undefined || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setMeasured(entry.contentRect.height || 600));
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportHeight]);

  // Keep the selection's far corner in view when the keyboard moves it; a mouse drag never scrolls.
  useEffect(() => {
    const element = gridRef.current;
    if (!element || dragging.current || holdScroll.current) return;
    const top = focus.row * ROW_HEIGHT;
    const visible = height - ROW_HEIGHT * 2;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top > element.scrollTop + visible) element.scrollTop = top - visible;
  }, [focus.row, height]);

  useEffect(() => {
    holdScroll.current = false;
  });

  function fill(extent: CellRange) {
    holdScroll.current = true;
    sheet.fill(extent);
  }

  // Starting an edit brings the active cell back into view (it may be off-screen after Shift+click or
  // scrolling), so the editor mounts and the keyboard keeps working, as in Excel.
  const isEditing = editing !== null;
  useEffect(() => {
    const element = gridRef.current;
    if (!element || !isEditing) return;
    const top = cursor.row * ROW_HEIGHT;
    const visible = height - ROW_HEIGHT * 2;
    if (top < element.scrollTop || top > element.scrollTop + visible) {
      element.scrollTop = top < element.scrollTop ? top : top - visible;
      setScrollTop(element.scrollTop);
    }
    // Only when an edit starts, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => () => endDragRef.current(), []);

  function startDrag() {
    endDragRef.current();
    dragging.current = true;
    endDragRef.current = startWindowDrag({
      onEnd: () => {
        dragging.current = false;
        endDragRef.current = () => {};
      },
    });
  }

  function startPointDrag() {
    endDragRef.current();
    pointDragging.current = true;
    endDragRef.current = startWindowDrag({
      onEnd: () => {
        pointDragging.current = false;
        endDragRef.current = () => {};
      },
    });
  }

  function onCellMouseDown(event: MouseEvent, cell: Cursor, active: boolean) {
    // Keep the caret when clicking inside the cell being edited.
    if (active && editing) return;
    pointedClick.current = false;
    if (editing) {
      // The editing input keeps focus while editing, so its caret is the one to use.
      const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
      const caret = focused?.selectionStart ?? editing.text.length;
      const selectionEnd = focused?.selectionEnd ?? caret;
      if (canPoint(editing.text, caret, editing.point, selectionEnd)) {
        // No default: the editor keeps focus (and the formula bar doesn't blur and commit).
        event.preventDefault();
        pointedClick.current = true;
        sheet.pointAt(cell, caret, event.shiftKey, selectionEnd);
        if (!event.shiftKey) startPointDrag();
        return;
      }
    }
    event.preventDefault();
    if (event.shiftKey) sheet.extendTo(cell);
    else {
      sheet.select(cell);
      startDrag();
    }
    gridRef.current?.focus({ preventScroll: true });
  }

  function onFillMouseDown(event: MouseEvent, source: CellRange) {
    event.preventDefault();
    event.stopPropagation();
    endDragRef.current();
    fillDragging.current = true;
    endDragRef.current = startWindowDrag({
      onEnd: (reason) => {
        const target = fillTargetRef.current;
        fillDragging.current = false;
        fillTargetRef.current = null;
        setFillTarget(null);
        endDragRef.current = () => {};
        // Only a release we saw fills; Alt+Tab or a lost release leaves the sheet as it was.
        const extent = reason === 'release' && target ? fillExtent(source, target) : undefined;
        if (extent) fill(extent);
      },
    });
  }

  function onCellMouseEnter(event: MouseEvent, cell: Cursor) {
    if (pointDragging.current) {
      if ((event.buttons & 1) === 0) endDragRef.current();
      // At once: React defers updates from mouse moves, and a keystroke arriving first would read the input's
      // old text and overwrite the range.
      else flushSync(() => sheet.pointTo(cell));
      return;
    }
    if (fillDragging.current) {
      if ((event.buttons & 1) === 0) endDragRef.current();
      else {
        fillTargetRef.current = cell;
        setFillTarget(cell);
      }
      return;
    }
    if (!dragging.current) return;
    // The button came up somewhere we didn't hear about: the drag is over.
    if ((event.buttons & 1) === 0) endDragRef.current();
    else sheet.extendTo(cell);
  }

  // Return focus to the grid after an in-cell edit ends, so the keyboard keeps working.
  useEffect(() => {
    if (!editing) gridRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(workbook.rowCount, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const rows = Array.from({ length: Math.max(0, last - first) }, (_, i) => first + i);

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (editing || event.target !== event.currentTarget) return;
    const { key } = event;
    if (MOVE_KEYS.has(key)) {
      event.preventDefault();
      sheet.moveCursor(key as MoveKey, event.shiftKey);
    } else if (key === 'F2') {
      event.preventDefault();
      sheet.startEdit(rawText(workbook, cursor.col, cursor.row));
    } else if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      sheet.clearSelection();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      sheet.startEdit(key);
    }
  }

  function onEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      sheet.commitEdit(event.key, event.shiftKey);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      sheet.cancelEdit();
    }
  }

  function onResizeStart(event: MouseEvent, col: number) {
    event.preventDefault();
    event.stopPropagation();
    resizedColumn.current = true;
    const startX = event.clientX;
    const startWidth = columnWidth(columnWidths, col);
    endDragRef.current();
    endDragRef.current = startWindowDrag({
      onMove: (move) => sheet.resizeColumn(col, startWidth + move.clientX - startX),
      onEnd: () => {
        endDragRef.current = () => {};
      },
    });
  }

  function sortBy(col: number) {
    const direction = lastSort?.col === col && lastSort.direction === 'asc' ? 'desc' : 'asc';
    setLastSort({ col, direction });
    sheet.select({ col, row: 1 });
    sheet.sort(direction);
  }

  const width = columnLeft(COLUMN_COUNT, columnWidths);
  const fillOutline = fillTarget ? fillExtent(range, fillTarget) : undefined;
  // While a formula is typed, one coloured box per distinct range it refers to.
  const refBoxes: { range: CellRange; color: string }[] = [];
  if (editing && isFormula(editing.text)) {
    const refs = findReferences(editing.text);
    const colours = referenceColors(refs);
    refs.forEach((ref, i) => {
      if (colours.indexOf(colours[i]) === i) refBoxes.push({ range: ref.range, color: referenceColor(colours[i]) });
    });
  }
  // Where a box around a range of cells sits inside the grid content.
  const boxStyle = (box: CellRange) => ({
    top: (box.top + 1) * ROW_HEIGHT,
    left: columnLeft(box.left, columnWidths),
    width: columnLeft(box.right + 1, columnWidths) - columnLeft(box.left, columnWidths),
    height: (box.bottom - box.top + 1) * ROW_HEIGHT,
  });

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-rowcount={workbook.rowCount + 1}
      aria-colcount={COLUMN_COUNT + 1}
      tabIndex={0}
      className="xl-grid"
      style={{ height: viewportHeight ?? '100%' }}
      onKeyDown={onGridKeyDown}
      onFocus={(event) => {
        // The grid can take focus mid-edit (a press on its scrollbar); hand it back so typing goes on.
        if (editing?.origin === 'cell' && event.target === event.currentTarget) {
          event.currentTarget.querySelector<HTMLInputElement>('.xl-cell-editor input')?.focus({ preventScroll: true });
        }
      }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ width, position: 'relative' }}>
        <div role="row" className="xl-header-row" style={{ height: ROW_HEIGHT }}>
          <div className="xl-corner" style={{ width: ROW_HEADER_WIDTH }} />
          {COLUMNS.map((c) => (
            <div
              key={c}
              role="columnheader"
              className={`xl-column-header${c >= range.left && c <= range.right ? ' xl-active-header' : ''}`}
              aria-label={columnLetter(c)}
              style={{ width: columnWidth(columnWidths, c) }}
              title="Click to sort"
              onMouseDown={() => {
                resizedColumn.current = false;
              }}
              onClick={() => {
                if (resizedColumn.current) resizedColumn.current = false;
                else sortBy(c);
              }}
            >
              {columnLetter(c)}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize column ${columnLetter(c)}`}
                className="xl-col-resizer"
                onMouseDown={(event) => onResizeStart(event, c)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  sheet.resizeColumn(c, autoFitWidth(values, c, measureText));
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ height: first * ROW_HEIGHT }} />
        {rows.map((r) => (
          <div key={r} role="row" className="xl-row" style={{ height: ROW_HEIGHT }}>
            <div
              role="rowheader"
              className={`xl-row-header${r >= range.top && r <= range.bottom ? ' xl-active-header' : ''}`}
              style={{ width: ROW_HEADER_WIDTH }}
            >
              {r + 1}
            </div>
            {COLUMNS.map((c) => {
              const address = toAddress(c, r);
              const selected = c === cursor.col && r === cursor.row;
              const inSelection = inRange(range, c, r);
              const value = values.get(address);
              const kind = isError(value ?? null) ? 'error' : typeof value === 'number' ? 'number' : 'text';
              return (
                <div
                  key={c}
                  role="gridcell"
                  aria-label={address}
                  aria-selected={inSelection}
                  className={`xl-cell xl-cell-${kind}${selected && single ? ' xl-selected' : ''}${
                    inSelection && !selected ? ' xl-in-range' : ''
                  }`}
                  style={{ width: columnWidth(columnWidths, c) }}
                  onMouseDown={(event) => onCellMouseDown(event, { col: c, row: r }, selected)}
                  onMouseEnter={(event) => onCellMouseEnter(event, { col: c, row: r })}
                  onClick={(event) => {
                    if (pointedClick.current) pointedClick.current = false;
                    else if (!selected && !event.shiftKey) sheet.select({ col: c, row: r });
                  }}
                  onDoubleClick={() => {
                    // While pointing, a double-click is two clicks into the formula, never a new edit.
                    if (!editing) sheet.startEdit(rawText(workbook, c, r));
                  }}
                >
                  {selected && editing ? (
                    // The cell editor overlay shows the text itself; only an edit in the formula bar shows here.
                    editing.origin === 'formula-bar' ? editing.text : null
                  ) : (
                    displayText(value)
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ height: Math.max(0, workbook.rowCount - last) * ROW_HEIGHT }} />
        {!single && (
          <div
            data-testid="selection-box"
            className="xl-selection-box"
            style={boxStyle(range)}
          />
        )}
        {refBoxes.map(({ range: box, color }) => (
          <div
            key={`${box.left},${box.top},${box.right},${box.bottom}`}
            data-testid="ref-box"
            className="xl-ref-box"
            style={{ ...boxStyle(box), borderColor: color }}
          />
        ))}
        {editing?.origin === 'cell' && (
          // Outside the rows, so scrolling the editing cell out of view never unmounts the editor.
          <div
            className="xl-cell-editor"
            style={boxStyle({ left: cursor.col, top: cursor.row, right: cursor.col, bottom: cursor.row })}
          >
            <FormulaInput
              className="xl-cell-input"
              ariaLabel="Cell editor"
              autoFocus
              value={editing.text}
              caret={editing.caret}
              onChange={(event) => sheet.changeEdit(event.target.value)}
              onKeyDown={onEditKeyDown}
            />
          </div>
        )}
        {fillOutline && (
          <div data-testid="fill-outline" className="xl-fill-outline" style={boxStyle(fillOutline)} />
        )}
        {!editing && (
          <div
            data-testid="fill-handle"
            className="xl-fill-handle"
            aria-hidden="true"
            style={{
              left: columnLeft(range.right + 1, columnWidths) - 4,
              top: (range.bottom + 2) * ROW_HEIGHT - 4,
            }}
            onMouseDown={(event) => onFillMouseDown(event, range)}
            onDoubleClick={() => {
              const extent = fillDownExtent(workbook, range);
              if (extent) fill(extent);
            }}
          />
        )}
      </div>
    </div>
  );
}
