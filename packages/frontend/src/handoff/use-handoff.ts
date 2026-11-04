// Runs the report → app handoff: read the link, query the model, shape the rows.

import { createFabricAppStateClient } from '@microsoft/rayfin-app-state-fabric';
import { toQueryResult } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getRayfinClient } from '@/lib/rayfin-client';

import { readLinkFilters, type LinkFilters } from './link-filters';
import { buildSalesQuery } from './sales-query';
import { toSheetData, type SheetData } from './sheet-data';

type Source = 'deep-link' | 'query-string' | 'load-all';

export type HandoffState =
  | { status: 'no-filters' }
  | { status: 'invalid-link'; reason: string }
  | { status: 'loading'; filters: LinkFilters }
  | { status: 'loaded'; filters: LinkFilters; source: Source; data: SheetData }
  | { status: 'empty'; filters: LinkFilters }
  | { status: 'error'; message: string };

type QueryResult =
  | { status: 'success'; table: { columns: { name: string }[]; rows: unknown[][] } }
  | { status: 'error'; error: { message: string } };

export interface HandoffDeps {
  launchState: () => unknown;
  search: () => string;
  runQuery: (dax: string) => Promise<QueryResult>;
}

// Read once per page load: the portal seeds the state into the URL before the app starts.
let launchStateRead = false;
let launchStateValue: unknown;
function readLaunchStateOnce(): unknown {
  if (!launchStateRead) {
    launchStateRead = true;
    try {
      launchStateValue = createFabricAppStateClient().getLaunchStateSync();
    } catch {
      launchStateValue = undefined;
    }
  }
  return launchStateValue;
}

async function runSalesQuery(dax: string): Promise<QueryResult> {
  const client = await getRayfinClient();
  return toQueryResult(await client.connectors.salesdemo.executeQuery({ query: dax }));
}

const defaultDeps: HandoffDeps = {
  launchState: readLaunchStateOnce,
  search: () => window.location.search,
  runQuery: runSalesQuery,
};

type Request = { filters: LinkFilters; source: Source };

function initial(deps: HandoffDeps): { state: HandoffState; request?: Request } {
  const link = readLinkFilters(deps.launchState(), deps.search());
  if (link.kind === 'none') return { state: { status: 'no-filters' } };
  if (link.kind === 'invalid') return { state: { status: 'invalid-link', reason: link.reason } };
  return {
    state: { status: 'loading', filters: link.filters },
    request: { filters: link.filters, source: link.source },
  };
}

export function useHandoff(overrides?: Partial<HandoffDeps>) {
  const [deps] = useState<HandoffDeps>(() => ({ ...defaultDeps, ...overrides }));
  const [start] = useState(() => initial(deps));
  const [state, setState] = useState<HandoffState>(start.state);
  const lastRequest = useRef<Request | undefined>(start.request);

  // Runs a request and resolves to the state it ends in.
  const execute = useCallback(
    async (request: Request): Promise<HandoffState> => {
      lastRequest.current = request;
      try {
        const result = await deps.runQuery(buildSalesQuery(request.filters));
        if (result.status === 'error') return { status: 'error', message: result.error.message };
        const data = toSheetData(result.table);
        return data.rows.length === 0
          ? { status: 'empty', filters: request.filters }
          : { status: 'loaded', filters: request.filters, source: request.source, data };
      } catch (error) {
        return { status: 'error', message: error instanceof Error ? error.message : String(error) };
      }
    },
    [deps]
  );

  const run = useCallback(
    (request: Request) => {
      setState({ status: 'loading', filters: request.filters });
      void execute(request).then(setState);
    },
    [execute]
  );

  useEffect(() => {
    if (!start.request) return;
    let cancelled = false;
    void execute(start.request).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [execute, start.request]);

  const loadAll = useCallback(() => run({ filters: {}, source: 'load-all' }), [run]);
  const retry = useCallback(() => {
    if (lastRequest.current) run(lastRequest.current);
  }, [run]);

  return { state, loadAll, retry };
}
