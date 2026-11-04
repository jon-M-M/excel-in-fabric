// The status bar under the sheet.

import { MAX_ROWS } from '@/handoff/sheet-data';
import { formatStatusNumber, type RangeSummary } from '@/sheet/selection';

export function StatusBar({
  status,
  summary,
  count,
  selection,
  truncated,
  note,
}: {
  status: 'Ready' | 'Loading…';
  summary?: string;
  count?: number;
  // Average / Count / Sum of a multi-cell selection; replaces the rows-loaded count, as in Excel.
  selection?: RangeSummary;
  truncated?: boolean;
  note?: string;
}) {
  return (
    <div className="xl-status-bar" role="status">
      <span>{status}</span>
      {summary && <span className="xl-status-summary">{summary}</span>}
      <span className="xl-status-spacer" />
      {note && <span>{note}</span>}
      {truncated && <span>Showing the first {MAX_ROWS.toLocaleString('en-US')} rows</span>}
      {selection ? (
        <>
          {selection.average !== undefined && <span>Average: {formatStatusNumber(selection.average)}</span>}
          <span>Count: {selection.count}</span>
          {selection.sum !== undefined && <span>Sum: {formatStatusNumber(selection.sum)}</span>}
        </>
      ) : (
        count !== undefined && <span>Count: {count}</span>
      )}
      <span className="xl-status-zoom">100%</span>
    </div>
  );
}
