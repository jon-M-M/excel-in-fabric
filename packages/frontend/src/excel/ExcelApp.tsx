// Excel in Fabric: the Excel window around the sheet, fed by the report handoff or a CSV file.

import { Redo2, Save, Search, Undo2 } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';

import { filterSummary, workbookName } from '@/handoff/filter-summary';
import type { SheetData } from '@/handoff/sheet-data';
import { useHandoff, type HandoffDeps, type HandoffState } from '@/handoff/use-handoff';
import { csvWorkbookName, parseCsv } from '@/sheet/csv-import';
import { summarizeRange } from '@/sheet/selection';
import { computeValues, emptyWorkbook, setCell, workbookFromSheetData, type Workbook } from '@/sheet/workbook';
import { workbookToXlsx, XLSX_MIME } from '@/sheet/xlsx-export';

import { downloadBlob } from './download';
import { ExcelDialog } from './ExcelDialog';
import { FormulaBar } from './FormulaBar';
import { Grid } from './Grid';
import { Ribbon } from './Ribbon';
import { StatusBar } from './StatusBar';
import { selectionRange, useSheet } from './use-sheet';
import './excel.css';

// Excel's limit for a worksheet name.
const MAX_SHEET_NAME = 31;

interface CsvSource {
  fileName: string;
  data: SheetData;
  droppedColumns: number;
}

interface WindowProps {
  name: string;
  sheetName: string;
  initial: Workbook;
  status: 'Ready' | 'Loading…';
  summary?: string;
  count?: number;
  truncated?: boolean;
  note?: string;
  onOpenCsv: () => void;
}

function ExcelLogo() {
  return (
    <svg className="xl-logo" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="1.5" fill="#fff" />
      <path d="M4.5 5l2 3-2 3h1.6L7.3 9l1.2 2h1.6l-2-3 2-3H8.5L7.3 7 6.1 5z" fill="#217346" />
    </svg>
  );
}

function ExcelWindow(props: WindowProps) {
  const sheet = useSheet(props.initial);
  const [exportError, setExportError] = useState<string>();
  // Only when the range or the values change: not per keystroke while editing or per move while resizing.
  const { left, top, right, bottom } = selectionRange(sheet.state);
  const { values } = sheet.state;
  const selection = useMemo(
    () => summarizeRange({ left, top, right, bottom }, values),
    [left, top, right, bottom, values]
  );

  async function exportXlsx() {
    // Include an edit that hasn't been committed yet, as Excel does when saving.
    const { workbook, cursor, editing } = sheet.state;
    const wb = editing ? setCell(workbook, cursor.col, cursor.row, editing.text) : workbook;
    if (editing) sheet.commitEdit();
    try {
      const bytes = await workbookToXlsx(wb, computeValues(wb), props.sheetName, sheet.state.columnWidths);
      downloadBlob(new Blob([bytes], { type: XLSX_MIME }), `${props.name}.xlsx`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="xl-app">
      <header className="xl-title-bar">
        <ExcelLogo />
        <span className="xl-quick-access" aria-hidden="true">
          <Save size={14} />
          <Undo2 size={14} />
          <Redo2 size={14} />
        </span>
        <h1 className="xl-title">{props.name} - Excel in Fabric</h1>
        <span className="xl-search" aria-hidden="true">
          <Search size={13} /> Search
        </span>
        <span className="xl-avatar" aria-hidden="true">
          JM
        </span>
      </header>
      <Ribbon
        actions={{
          openCsv: props.onOpenCsv,
          exportXlsx: () => void exportXlsx(),
          autoSum: sheet.autoSum,
          sortAscending: () => sheet.sort('asc'),
          sortDescending: () => sheet.sort('desc'),
        }}
      />
      <FormulaBar sheet={sheet} />
      <div className="xl-grid-area">
        <Grid sheet={sheet} />
      </div>
      <div className="xl-sheet-tabs">
        <button type="button" className="xl-sheet-tab xl-sheet-tab-active">
          {props.sheetName}
        </button>
        <button type="button" className="xl-sheet-add" aria-label="New sheet" title="Available in Excel in Fabric Pro">
          +
        </button>
      </div>
      <StatusBar
        status={props.status}
        summary={props.summary}
        count={props.count}
        selection={selection}
        truncated={props.truncated}
        note={props.note}
      />
      {exportError && (
        <ExcelDialog message={`Couldn't export the workbook: ${exportError}`}>
          <button type="button" className="xl-dialog-btn" onClick={() => setExportError(undefined)}>
            OK
          </button>
        </ExcelDialog>
      )}
    </div>
  );
}

function handoffKey(state: HandoffState): string {
  return state.status === 'loaded'
    ? `loaded:${state.source}:${state.data.rows.length}:${JSON.stringify(state.filters)}`
    : 'empty';
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read'));
    reader.readAsText(file);
  });
}

export function ExcelApp({ deps }: { deps?: Partial<HandoffDeps> }) {
  const { state, loadAll, retry } = useHandoff(deps);
  const [csv, setCsv] = useState<CsvSource | null>(null);
  const [csvLoads, setCsvLoads] = useState(0);
  const [csvProblem, setCsvProblem] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const openCsv = () => fileInput.current?.click();

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires a change.
    input.value = '';
    if (!file) return;
    try {
      const result = parseCsv(await readFileText(file));
      if (result.kind === 'empty') setCsvProblem('This CSV file is empty');
      else if (result.kind === 'invalid') setCsvProblem(`Couldn't read this CSV: ${result.reason}`);
      else {
        setCsvProblem(undefined);
        setCsv({ fileName: file.name, data: result.data, droppedColumns: result.droppedColumns });
        setCsvLoads((n) => n + 1);
      }
    } catch (error) {
      setCsvProblem(`Couldn't read this CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const handoffWorkbook = useMemo(
    () => (state.status === 'loaded' ? workbookFromSheetData(state.data) : emptyWorkbook()),
    [state]
  );
  const csvWorkbook = useMemo(() => (csv ? workbookFromSheetData(csv.data) : undefined), [csv]);

  let view: WindowProps & { key: string };
  if (csv && csvWorkbook) {
    const name = csvWorkbookName(csv.fileName);
    view = {
      key: `csv:${csvLoads}`,
      name,
      sheetName: name.slice(0, MAX_SHEET_NAME),
      initial: csvWorkbook,
      status: 'Ready',
      summary: `From ${csv.fileName}`,
      count: csv.data.rows.length,
      truncated: csv.data.truncated,
      note: csv.droppedColumns > 0 ? `${csv.droppedColumns} columns past Z were left out` : undefined,
      onOpenCsv: openCsv,
    };
  } else {
    const loaded = state.status === 'loaded' ? state : undefined;
    view = {
      key: handoffKey(state),
      name: loaded ? workbookName(loaded.filters) : 'Book1',
      sheetName: loaded ? 'Sales' : 'Sheet1',
      initial: handoffWorkbook,
      status: state.status === 'loading' ? 'Loading…' : 'Ready',
      summary: loaded ? filterSummary(loaded.filters) : undefined,
      count: loaded?.data.rows.length,
      truncated: loaded?.data.truncated,
      onOpenCsv: openCsv,
    };
  }
  const { key, ...windowProps } = view;
  // A loaded CSV replaces whatever the handoff showed, including its dialogs.
  const handoffDialogs = !csv;

  return (
    <>
      {/* A new key mounts a fresh sheet whenever new data arrives. */}
      <ExcelWindow key={key} {...windowProps} />

      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        aria-label="Open CSV file"
        hidden
        onChange={(event) => void onFileChosen(event)}
      />

      {csvProblem && (
        <ExcelDialog message={csvProblem}>
          <button type="button" className="xl-dialog-btn" onClick={() => setCsvProblem(undefined)}>
            OK
          </button>
        </ExcelDialog>
      )}
      {handoffDialogs && !csvProblem && state.status === 'no-filters' && (
        <ExcelDialog message="No filters came through from the report">
          <button type="button" className="xl-dialog-btn" onClick={loadAll}>
            Load all data
          </button>
          <button type="button" className="xl-dialog-btn" onClick={openCsv}>
            Open CSV
          </button>
        </ExcelDialog>
      )}
      {handoffDialogs && !csvProblem && state.status === 'invalid-link' && (
        <ExcelDialog message="This link's filters couldn't be read" detail={state.reason}>
          <button type="button" className="xl-dialog-btn" onClick={loadAll}>
            Load all data
          </button>
        </ExcelDialog>
      )}
      {handoffDialogs && !csvProblem && state.status === 'empty' && (
        <ExcelDialog message="No rows for these filters">
          <button type="button" className="xl-dialog-btn" onClick={loadAll}>
            Load all data
          </button>
        </ExcelDialog>
      )}
      {handoffDialogs && !csvProblem && state.status === 'error' && (
        <ExcelDialog message={`We couldn't load the data: ${state.message}`}>
          <button type="button" className="xl-dialog-btn" onClick={retry}>
            Retry
          </button>
          <button type="button" className="xl-dialog-btn" onClick={openCsv}>
            Open CSV instead
          </button>
        </ExcelDialog>
      )}
    </>
  );
}
