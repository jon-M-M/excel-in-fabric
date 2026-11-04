import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { chainRow, deps, launch, ok } from './test-helpers';
import { useHandoff, type HandoffDeps } from './use-handoff';

describe('useHandoff', () => {
  it('does not query when no filters came through', () => {
    const runQuery = vi.fn<HandoffDeps['runQuery']>(() => ok([chainRow]));
    const { result } = renderHook(() => useHandoff(deps({ runQuery })));
    expect(result.current.state).toEqual({ status: 'no-filters' });
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('queries with the launch-state filters', async () => {
    const runQuery = vi.fn<HandoffDeps['runQuery']>(() => ok([chainRow]));
    const { result } = renderHook(() =>
      useHandoff(deps({ launchState: launch({ region: ['North', 'South'] }), runQuery }))
    );
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(runQuery).toHaveBeenCalledOnce();
    expect(runQuery.mock.calls[0][0]).toContain(`TREATAS({"North", "South"}, 'Region'[Region])`);
    expect(result.current.state).toMatchObject({
      source: 'deep-link',
      data: { rows: [chainRow.slice(0, 6)] },
    });
  });

  it('loads all data on request', async () => {
    const runQuery = vi.fn<HandoffDeps['runQuery']>(() => ok([chainRow]));
    const { result } = renderHook(() => useHandoff(deps({ runQuery })));
    act(() => result.current.loadAll());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(runQuery.mock.calls[0][0]).not.toContain('TREATAS');
    expect(result.current.state).toMatchObject({ source: 'load-all' });
  });

  it('reports an invalid link', () => {
    const runQuery = vi.fn<HandoffDeps['runQuery']>(() => ok([chainRow]));
    const { result } = renderHook(() =>
      useHandoff(deps({ launchState: () => ({ v: 2 }), runQuery }))
    );
    expect(result.current.state.status).toBe('invalid-link');
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('ends empty for zero rows', async () => {
    const { result } = renderHook(() =>
      useHandoff(deps({ launchState: launch({}), runQuery: () => ok([]) }))
    );
    await waitFor(() => expect(result.current.state.status).toBe('empty'));
  });

  it('ends in error when the query throws', async () => {
    const { result } = renderHook(() =>
      useHandoff(
        deps({
          launchState: launch({}),
          runQuery: () => Promise.reject(new Error('403 Forbidden')),
        })
      )
    );
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'error', message: '403 Forbidden' })
    );
  });

  it('ends in error when the query returns an error result', async () => {
    const { result } = renderHook(() =>
      useHandoff(
        deps({
          launchState: launch({}),
          runQuery: () =>
            Promise.resolve({ status: 'error' as const, error: { message: 'bad DAX' } }),
        })
      )
    );
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'error', message: 'bad DAX' })
    );
  });

  it('retries the last query', async () => {
    const runQuery = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockImplementation(() => ok([chainRow]));
    const { result } = renderHook(() =>
      useHandoff(deps({ launchState: launch({ year: [2026] }), runQuery }))
    );
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(runQuery.mock.calls[1][0]).toBe(runQuery.mock.calls[0][0]);
  });
});
