# Excel in Fabric — sheet polish (selection, status bar, column resize, fill handle, point mode)

> Design notes written with Claude Code while the app was being built, kept as a record of the decisions.
> They mention the original workspace and a livestream demo; the setup steps that apply to you are in the README.

Date: 2026-10-22. Status: approved 2026-10-22. Builds on `2026-10-19-excel-in-fabric-design.md` (phases 1–5,
demo-ready and rehearsed).

## Intent

The Fabric Apps demo (now the second week of November 2026, moved from end of October) shows the app for a few minutes. Today you can type, AutoSum, sort, export and
open a CSV, but only one cell can be selected at a time. These additions are the Excel habits Jon will do live
without thinking: drag across numbers and glance at the bottom right, widen a column, drag a formula down, and build
a formula by clicking cells. Each one should look and feel like real Excel at a glance, which is what the joke
depends on, and none of them may put the existing demo path at risk.

## What Jon asked for

1. **Sum / Average / Count in the bottom right** of the status bar for a selected range.
2. **Resizable columns.**
3. **Fill handle:** drag the corner square to copy formulas down or across.
4. **Click cells while typing a formula** (Excel's point mode), **with coloured reference boxes** like Excel's.

Order of importance is the order above. Point mode with coloured boxes is the largest piece; if time runs short it
ships without the colours (plain click-to-insert) rather than late.

## Goals

### 0. Range selection (the base the rest needs)

- A selection is an anchor cell (the active cell, white, shown in the name box) plus a rectangle. Single-cell
  selection is the rectangle of one cell.
- Mouse drag across cells selects a rectangle; Shift+click extends from the active cell; Shift+arrow extends by one
  cell. Plain arrows, Enter, Tab and a plain click collapse to one cell, as now.
- Selecting a whole row by clicking its number is not needed. Clicking a column letter keeps sorting (existing
  behaviour; changing it would break the rehearsed demo).
- Look: Excel's green 2px border around the whole rectangle, light grey-green fill on the non-active cells, the
  active cell unfilled; row numbers and column letters of the selection highlighted (the existing active-header
  style, extended to the range).
- Delete/Backspace clears every cell in the selection.
- **No auto-scroll (Jon's decision).** Dragging (selection, fill handle, point mode) stops at the visible edge of the
  grid; the grid does not scroll while a drag is in progress. Tall ranges are made by scrolling with the wheel or
  scrollbar and then Shift+clicking the far corner, and long fills use the fill-handle double-click. Scrolling with
  the wheel while a selection exists keeps the selection.
- Typing, F2 and double-click edit the active cell only, as now.
- The name box shows the active cell's address while selecting (Excel shows `5R x 3C` while dragging; my call: skip
  that).

### 1. Status bar summary

- When the selection has more than one cell: `Average: …  Count: …  Sum: …` on the right of the status bar, in
  that order, as Excel does. Count = non-empty cells (numbers, text, errors). Average and Sum use numeric values
  only (formula results included) and appear only when at least one cell is a number. Number display uses Excel's
  General-like formatting (the existing `displayText`), with thousands separators (my call: Excel shows them for
  formatted cells; `880,362` reads better on a shared screen).
- If any numeric cell in the selection is an error, Excel shows nothing for Average/Sum; do the same.
- With more than one cell selected, these replace today's `Count: <rows loaded>` (otherwise `Count:` would show
  twice). With a single cell selected, the status bar stays as it is today, showing `Count: <rows loaded>` (my call,
  it is part of the rehearsed look).

### 2. Resizable columns

- Dragging the right edge of a column letter resizes that column; the cursor turns to Excel's resize cursor on the
  edge. Minimum width about 20px; no maximum beyond something sane (e.g. 600px).
- Double-clicking the edge auto-fits the column to its widest displayed value (header row included), within the
  same limits.
- A drag on the edge must never trigger the column's click-to-sort.
- Widths live in sheet state (per column, default 96px). Loading new data (report handoff, Open CSV, Load all data)
  resets them to the default.
- Export: a column the user resized or auto-fitted is written with that width (converted from pixels to Excel
  character units, roughly px / 7); untouched columns keep today's content-based widths.

### 3. Fill handle

- A small green square at the bottom-right corner of the selection (Excel's fill handle). Dragging it down, up,
  right or left extends a dashed outline along one axis (whichever the pointer has moved further along), and on
  release fills the new cells by repeating the selected block.
- Formulas: relative references shift by the distance moved (row and column); `$`-anchored parts stay. A reference
  shifted off the sheet (above row 1, left of A, right of Z) becomes `#REF!` in the formula, as Excel does. Text in
  quotes is left alone. This generalises the existing `shiftFormula` in `sheet/workbook.ts` (which shifts rows only,
  within the data block).
- Values (numbers, text) are copied as they are. No series filling (1, 2 → 3, 4) — non-goal.
- Fill overwrites what was in the target cells, as Excel does. After the fill the selection covers the source plus
  the filled cells.
- The grid may need to grow: filling past the last row extends `rowCount` (my call: cap at the existing 5,000 + 50
  limit).
- Double-click on the fill handle (Excel fills down to the end of the adjacent data) — nice to have, only if cheap;
  my call: include it, filling down as far as the column to the left has values, since it is the fastest way to
  fill 480 rows on stage.

### 4. Point mode with coloured reference boxes

- While editing a formula (text starts with `=`, in the cell or the formula bar) and the text before the caret ends
  with `=`, an operator (`+ - * /`), `(` or `,` — or the caret is right after a reference this same point action
  inserted — clicking a cell inserts its address at the caret; dragging inserts a range (`C2:C20`); further dragging
  in the same gesture replaces the reference just inserted rather than adding another. Clicking a different cell
  while the last token is a point-inserted reference replaces it, as Excel does. Shift+click while a point-inserted
  reference is last turns it into a range from that reference to the clicked cell (so `C2` then scroll, Shift+click
  C481 gives `C2:C481`; this is how long ranges are pointed at, since there is no auto-scroll).
- Scrolling the grid while editing must not close the edit or lose the caret, even when the editing cell's row
  scrolls out of view (today the in-cell `<input>` only exists while its row is rendered, and an effect pulls the
  cursor row back into view). How is left to the builder.
- When the caret is not at such a point, clicking a cell commits the edit and selects the cell (today's behaviour).
- Keyboard point mode (arrow keys inserting references) is a non-goal: arrow keys keep their current behaviour while
  editing. My call — it adds a modal subtlety that is easy to trip over live, and the mouse is what will be shown.
- The edit stays open and keeps the caret where it was; focus returns to the input that was editing (cell or formula
  bar).
- Coloured boxes: every cell reference and range in the formula being edited gets a colour from Excel's sequence
  (blue `#4472C4`-ish, red, purple, green, …, cycling), drawn two ways at once:
  - the reference text in the cell editor and the formula bar is shown in that colour;
  - a coloured border around the referenced cells in the grid (Excel draws a 1–2px border in the colour, with small
    corner squares; the corner squares are optional).
  The same reference written twice gets the same colour. Boxes appear only while editing and disappear on commit or
  Escape. References off-screen just aren't visible; no scrolling to them.
- Coloured text needs the editor to render styled text, which a plain `<input>` can't. Left to the builder how
  (e.g. a styled mirror layer behind a transparent input), but the input must keep normal caret, selection,
  typing and IME behaviour.

## Non-goals

- Copy/cut/paste, undo/redo, new functions, cell formatting (bold, fill, number formats), freeze panes — not asked
  for this round.
- Series fill, fill options menu, Ctrl+D/Ctrl+R.
- Whole-row/whole-column selection, Ctrl+A, multiple disjoint selections (Ctrl+click), Ctrl+Shift+arrow.
- Dragging a coloured reference box to change the reference (Excel can; not needed).
- Row height resizing.
- Touch or mobile.

## Anti-goals

- Anything that breaks or changes the rehearsed demo path: report handoff, AutoSum in the
  total row, `=F482/2`, column-letter sort, File → Export and Open CSV must behave exactly as they do now. The
  runbook is re-run at the end.
- A selection or drag that gets stuck (e.g. mouse released outside the grid leaves a drag going). Every pointer
  gesture ends cleanly on release anywhere, including outside the browser window.
- Sluggishness on the 480-row demo sheet or the 5,000-row cap: dragging must stay smooth (the grid already renders
  only the visible rows; overlays must not undo that).
- A clicked cell landing in the formula when the user meant to leave the edit — the point-mode rule above must match
  Excel's closely enough that Jon's habits work.

## Constraints

- Same as the base design: Rayfin 1.36.2 pinned, hand-built grid and evaluator (no grid or spreadsheet library),
  TDD for the sheet logic (`packages/frontend/src/sheet/`), existing tests keep passing.
- Must be built, deployed and rehearsed in the portal a few days before the demo (second week of November 2026).
- If time runs short, cut in this order: column auto-fit double-click, fill-handle double-click, resized widths in
  the export, Shift+arrow, then the coloured boxes (keeping plain click-to-insert).
- Work is committed on `main`, as phases 1–5 were.

## Calls Claude made (check these)

- Column-letter click keeps sorting; no whole-column selection.
- Multi-cell selection replaces `Count: <rows loaded>`; a single cell leaves it as today.
- Shift+click extends a point-inserted reference into a range (the no-auto-scroll way to point at long ranges).
- Thousands separators in the status-bar Sum/Average.
- Name box shows the active cell during a drag, not `5R x 3C`.
- Fill handle double-click fills down to the end of the column on the left (included).
- No keyboard point mode.
- Widths reset when new data loads; only user-set widths override the export's content-based widths.
- If point mode runs late, ship click-to-insert without the coloured boxes rather than slip.

## Left to the builder

- Exact colours, border thickness and cursor styles (match current Excel as closely as practical).
- How the selection, fill outline and reference boxes are drawn (overlay layer vs. per-cell classes), as long as
  only visible rows are rendered.
- How the coloured editor text is rendered.
- Module structure, state shape and how the existing `use-sheet` reducer grows.
- Splitting the work into plan phases.
