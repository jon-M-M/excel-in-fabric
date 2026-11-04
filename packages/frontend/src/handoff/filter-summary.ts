// Plain-words descriptions of the report's filters, for the status bar and the workbook title.

import type { LinkFilters } from './link-filters';

export function filterSummary(filters: LinkFilters): string {
  const parts = [
    filters.region && `Region: ${filters.region.join(', ')}`,
    filters.year && `Year: ${filters.year.join(', ')}`,
    filters.category && `Category: ${filters.category.join(', ')}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'All data';
}

// sales_north_south_2026, or sales_all when nothing is filtered.
export function workbookName(filters: LinkFilters): string {
  const values = [...(filters.region ?? []), ...(filters.year ?? []), ...(filters.category ?? [])];
  return values.length > 0 ? `sales_${values.join('_').toLowerCase()}` : 'sales_all';
}
