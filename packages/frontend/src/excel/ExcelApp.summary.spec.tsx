import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { deps, launch } from '@/handoff/test-helpers';
import { summarizeRange } from '@/sheet/selection';

import { ExcelApp } from './ExcelApp';

// Count summaries without changing what they return.
vi.mock('@/sheet/selection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sheet/selection')>();
  return { ...actual, summarizeRange: vi.fn(actual.summarizeRange) };
});

describe('ExcelApp status-bar summary', () => {
  it('is not recomputed while a column is resized', async () => {
    render(<ExcelApp deps={deps({ launchState: launch({ region: ['North'], year: [2026] }) })} />);
    await waitFor(() => expect(screen.getByRole('gridcell', { name: 'D2' })).toHaveTextContent('Chain'));
    fireEvent.mouseDown(screen.getByRole('gridcell', { name: 'E1' }));
    fireEvent.mouseEnter(screen.getByRole('gridcell', { name: 'F2' }), { buttons: 1 });
    fireEvent.mouseUp(window);
    const before = vi.mocked(summarizeRange).mock.calls.length;
    fireEvent.mouseDown(screen.getByRole('separator', { name: 'Resize column B' }), { clientX: 100 });
    for (let x = 110; x <= 150; x += 10) fireEvent.mouseMove(window, { clientX: x, buttons: 1 });
    fireEvent.mouseUp(window);
    expect(screen.getByRole('columnheader', { name: 'B' }).style.width).toBe('146px');
    expect(vi.mocked(summarizeRange).mock.calls.length).toBe(before);
  });
});
