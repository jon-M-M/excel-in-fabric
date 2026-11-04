import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { deps, launch } from '@/handoff/test-helpers';
import { XLSX_MIME } from '@/sheet/xlsx-export';

import { downloadBlob } from './download';
import { ExcelApp } from './ExcelApp';

vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

const northSouth2026 = launch({ region: ['North', 'South'], year: [2026] });
const csvFile = (text: string, name = 'Sales Export.csv') => new File([text], name, { type: 'text/csv' });

function chooseFile(file: File) {
  const input = screen.getByLabelText('Open CSV file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

function openFileMenu() {
  fireEvent.click(screen.getByRole('tab', { name: 'File' }));
  return screen.getByRole('menu', { name: 'File' });
}

// File reads and the first ExcelJS import are slow under a full parallel test run.
const slow = { timeout: 10000 };

describe('ExcelApp files', () => {
  // Load ExcelJS once up front, so each export only pays for writing the file.
  beforeAll(async () => {
    await import('exceljs');
  }, 30000);
  beforeEach(() => vi.mocked(downloadBlob).mockReset());

  it('exports the sheet as xlsx', { timeout: 20000 }, async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    await screen.findByText('sales_north_south_2026 - Excel in Fabric');
    await waitFor(() => expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain'));
    fireEvent.click(within(openFileMenu()).getByRole('menuitem', { name: 'Export to Excel (.xlsx)' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce(), slow);
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(XLSX_MIME);
    expect(name).toBe('sales_north_south_2026.xlsx');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('export keeps a resized column width', { timeout: 20000 }, async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    await waitFor(() => expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain'));
    fireEvent.mouseDown(screen.getByRole('separator', { name: 'Resize column B' }), { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 154, buttons: 1 });
    fireEvent.mouseUp(window);
    fireEvent.click(within(openFileMenu()).getByRole('menuitem', { name: 'Export to Excel (.xlsx)' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce(), slow);
    const [blob] = vi.mocked(downloadBlob).mock.calls[0];
    const { default: Excel } = await import('exceljs');
    const read = new Excel.Workbook();
    await read.xlsx.load(await blob.arrayBuffer());
    expect(read.worksheets[0].getColumn('B').width).toBeCloseTo(150 / 7, 2);
  });

  it('opens a CSV from the File menu', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    expect(within(openFileMenu()).getByRole('menuitem', { name: 'Open CSV…' })).toBeEnabled();
    chooseFile(csvFile('Region,Sales\nNorth,100\n'));
    expect(await screen.findByText('Sales Export - Excel in Fabric', undefined, slow)).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveTextContent('North');
    expect(screen.getByRole('button', { name: 'Sales Export' })).toBeInTheDocument();
    expect(screen.getByText('From Sales Export.csv')).toBeInTheDocument();
  });

  it('opens a CSV from the no-filters dialog', { timeout: 20000 }, async () => {
    render(<ExcelApp deps={deps({})} />);
    const dialog = await screen.findByRole('alertdialog', { name: 'Microsoft Excel' });
    expect(within(dialog).getByRole('button', { name: 'Open CSV' })).toBeEnabled();
    chooseFile(csvFile('Region,Sales\nNorth,100\n'));
    await waitFor(() => expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveTextContent('North'), slow);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens the same file twice', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    const input = chooseFile(csvFile('Region,Sales\nNorth,100\n'));
    await screen.findByText('Sales Export - Excel in Fabric', undefined, slow);
    expect(input.value).toBe('');
  });

  it('shows a dialog for an empty CSV', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    chooseFile(csvFile(''));
    const dialog = await screen.findByRole('alertdialog', { name: 'Microsoft Excel' }, slow);
    expect(within(dialog).getByText('This CSV file is empty')).toBeInTheDocument();
  });

  it('exports a CSV under its own name', { timeout: 20000 }, async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    chooseFile(csvFile('Region,Sales\nNorth,100\n'));
    await screen.findByText('Sales Export - Excel in Fabric', undefined, slow);
    fireEvent.click(within(openFileMenu()).getByRole('menuitem', { name: 'Export to Excel (.xlsx)' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce(), slow);
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Sales Export.xlsx');
  });

  it('closes the File menu on Escape', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    fireEvent.keyDown(openFileMenu(), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the File menu on Escape anywhere', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    openFileMenu();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('the File menu leaves the keyboard on the sheet', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    expect(fireEvent.mouseDown(screen.getByRole('tab', { name: 'File' }))).toBe(false);
    for (const item of within(openFileMenu()).getAllByRole('menuitem')) {
      expect(fireEvent.mouseDown(item)).toBe(false);
    }
  });
});
