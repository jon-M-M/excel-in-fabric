import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { chainRow, deps, launch, ok } from '@/handoff/test-helpers';
import type { HandoffDeps } from '@/handoff/use-handoff';

import { ExcelApp } from './ExcelApp';

const northSouth2026 = launch({ region: ['North', 'South'], year: [2026] });
const dialog = () => screen.findByRole('alertdialog', { name: 'Microsoft Excel' });

describe('ExcelApp', () => {
  it('keeps the splash up until the data has loaded', async () => {
    let resolve: (value: Awaited<ReturnType<HandoffDeps['runQuery']>>) => void = () => {};
    const runQuery = () => new Promise<Awaited<ReturnType<HandoffDeps['runQuery']>>>((r) => (resolve = r));
    render(<ExcelApp deps={deps({ launchState: northSouth2026, runQuery })} />);
    expect(screen.getByRole('status', { name: 'Starting Excel in Fabric' })).toHaveTextContent('Opening your data…');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    resolve(await ok([chainRow]));
    await waitFor(() => expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain'));
    expect(screen.queryByRole('status', { name: 'Starting Excel in Fabric' })).not.toBeInTheDocument();
  });

  it('shows the Excel chrome', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    for (const name of ['File', 'Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'AutoSum' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('titles the workbook after the filters', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    expect(await screen.findByText('sales_north_south_2026 - Excel in Fabric')).toBeInTheDocument();
  });

  it('loads the rows into the sheet', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    await waitFor(() =>
      expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain')
    );
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
    expect(screen.getByText('Region: North, South · Year: 2026')).toBeInTheDocument();
  });

  it('shows the no-filters dialog', async () => {
    render(<ExcelApp deps={deps({})} />);
    expect(within(await dialog()).getByText('No filters came through from the report')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load all data' }));
    await waitFor(() =>
      expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain')
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows no rows for an empty result', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026, runQuery: () => ok([]) })} />);
    expect(within(await dialog()).getByText('No rows for these filters')).toBeInTheDocument();
  });

  it('shows the error dialog with Retry', async () => {
    const runQuery = vi
      .fn<HandoffDeps['runQuery']>()
      .mockRejectedValueOnce(new Error('403 Forbidden'))
      .mockImplementation(() => ok([chainRow]));
    render(<ExcelApp deps={deps({ launchState: northSouth2026, runQuery })} />);
    expect(within(await dialog()).getByText(/403 Forbidden/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(runQuery).toHaveBeenCalledTimes(2));
  });

  it('says when rows were capped', async () => {
    const rows = Array.from({ length: 5001 }, () => chainRow);
    render(<ExcelApp deps={deps({ launchState: northSouth2026, runQuery: () => ok(rows) })} />);
    expect(await screen.findByText('Showing the first 5,000 rows')).toBeInTheDocument();
  });

  it('AutoSum from the ribbon', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    await waitFor(() =>
      expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain')
    );
    fireEvent.click(screen.getByRole('gridcell', { name: 'F3' }));
    fireEvent.click(screen.getByRole('button', { name: 'AutoSum' }));
    expect(screen.getByRole('gridcell', { name: 'F3' })).toHaveTextContent('90');
  });

  it('inert tabs say so', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    expect(screen.getByRole('tab', { name: 'Insert' })).toHaveAttribute(
      'title',
      'Available in Excel in Fabric Pro'
    );
  });

  it('ribbon buttons leave the keyboard on the sheet', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    for (const name of ['AutoSum', 'Sort A to Z', 'Sort Z to A']) {
      // A cancelled mousedown means the button never takes focus from the grid.
      expect(fireEvent.mouseDown(screen.getByRole('button', { name }))).toBe(false);
    }
  });

  it('selecting a range shows its sum', async () => {
    render(<ExcelApp deps={deps({ launchState: northSouth2026 })} />);
    await screen.findByRole('grid');
    await waitFor(() => expect(screen.getByRole('gridcell', { name: 'F2' })).toHaveTextContent('90'));
    fireEvent.mouseDown(screen.getByRole('gridcell', { name: 'F1' }));
    fireEvent.mouseEnter(screen.getByRole('gridcell', { name: 'F2' }), { buttons: 1 });
    fireEvent.mouseUp(window);
    expect(screen.getByText('Count: 2')).toBeInTheDocument();
    expect(screen.getByText('Sum: 90')).toBeInTheDocument();
    expect(screen.queryByText('Count: 1')).not.toBeInTheDocument();
  });
});
