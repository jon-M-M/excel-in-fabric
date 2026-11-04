// Test helpers for the handoff specs.
import type { HandoffDeps } from './use-handoff';

export const QUERY_COLUMNS = [
  '[Year]',
  '[Month]',
  '[Region]',
  '[Product]',
  '[Quantity]',
  '[Sales Amount]',
  '[Month Number]',
].map((name) => ({ name }));

export const ok = (rows: unknown[][]) =>
  Promise.resolve({ status: 'success' as const, table: { columns: QUERY_COLUMNS, rows } });

export const chainRow = [2026, 'Jan', 'North', 'Chain', 3, 90, 1];

export const launch = (filters: object) => () => ({ v: 1, source: 'sales_demo', filters });

export function deps(overrides: Partial<HandoffDeps>): Partial<HandoffDeps> {
  return {
    launchState: () => undefined,
    search: () => '',
    runQuery: () => ok([chainRow]),
    ...overrides,
  };
}
