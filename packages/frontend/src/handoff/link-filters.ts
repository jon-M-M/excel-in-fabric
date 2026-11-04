// Reads the report's filters from the link the app was opened with (link contract:
// "How the report hands over its filters" in the README).
// Link values are untrusted: only allow-listed keys and values get through.

export interface LinkFilters {
  region?: string[];
  year?: number[];
  category?: string[];
}

export type LinkResult =
  | { kind: 'filters'; source: 'deep-link' | 'query-string'; filters: LinkFilters }
  | { kind: 'none' }
  | { kind: 'invalid'; reason: string };

export const REGIONS: readonly string[] = ['East', 'North', 'South', 'West'];
export const CATEGORIES: readonly string[] = [
  'Accessories',
  'Bikes',
  'Clothing',
  'Components',
];
export const YEARS: readonly number[] = [2025, 2026];

const SOURCE = 'sales_demo';

class InvalidLink extends Error {}

function allowed<T>(key: string, values: unknown[], list: readonly T[]): T[] {
  for (const value of values) {
    if (!list.includes(value as T)) {
      throw new InvalidLink(`"${String(value)}" is not a known ${key}`);
    }
  }
  return [...new Set(values as T[])].sort();
}

// A Map, not an object: link keys like `constructor` or `__proto__` must not touch the prototype.
function build(raw: Map<string, unknown[]>): LinkFilters {
  const filters: LinkFilters = {};
  for (const [key, values] of raw) {
    if (key === 'region') filters.region = allowed(key, values, REGIONS);
    else if (key === 'year') filters.year = allowed(key, values, YEARS).sort((a, b) => a - b);
    else if (key === 'category') filters.category = allowed(key, values, CATEGORIES);
    else throw new InvalidLink(`"${key}" is not a filter this app understands`);
  }
  for (const key of Object.keys(filters) as (keyof LinkFilters)[]) {
    if (filters[key]?.length === 0) delete filters[key];
  }
  return filters;
}

function fromLaunchState(state: unknown): LinkFilters {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new InvalidLink('the link state is not an object');
  }
  const { v, source, filters } = state as Record<string, unknown>;
  if (v !== 1) throw new InvalidLink(`link version ${String(v)} is not supported`);
  if (source !== SOURCE) throw new InvalidLink(`the link comes from "${String(source)}", not ${SOURCE}`);
  if (typeof filters !== 'object' || filters === null || Array.isArray(filters)) {
    throw new InvalidLink('the link has no filters object');
  }
  const raw = new Map<string, unknown[]>();
  for (const [key, values] of Object.entries(filters)) {
    if (!Array.isArray(values)) throw new InvalidLink(`"${key}" is not a list`);
    raw.set(key, values);
  }
  return build(raw);
}

function fromQueryString(params: URLSearchParams): LinkFilters {
  const raw = new Map<string, unknown[]>();
  for (const [key, value] of params) {
    if (key === 'source') continue;
    const parsed = key === 'year' && /^\d+$/.test(value) ? Number(value) : value;
    raw.set(key, [...(raw.get(key) ?? []), parsed]);
  }
  return build(raw);
}

export function readLinkFilters(launchState: unknown, search: string): LinkResult {
  try {
    if (launchState !== undefined) {
      return { kind: 'filters', source: 'deep-link', filters: fromLaunchState(launchState) };
    }
    const params = new URLSearchParams(search);
    if (params.get('source') === SOURCE) {
      return { kind: 'filters', source: 'query-string', filters: fromQueryString(params) };
    }
    return { kind: 'none' };
  } catch (error) {
    if (error instanceof InvalidLink) return { kind: 'invalid', reason: error.message };
    throw error;
  }
}
