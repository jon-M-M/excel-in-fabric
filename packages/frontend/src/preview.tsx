// Dev-only preview of the Excel window with fixture data, no sign-in or Fabric needed.
// ?state=loaded | no-filters | error | loading | empty

import { createRoot } from 'react-dom/client';

import { ExcelApp } from './excel/ExcelApp';
import type { HandoffDeps } from './handoff/use-handoff';

import './global.css';

const PRODUCTS = ['Bottle', 'Brakes', 'Chain', 'Gloves', 'Helmet', 'Jacket', 'Mountain100', 'Pedals'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
const COLUMNS = ['[Year]', '[Month]', '[Region]', '[Product]', '[Quantity]', '[Sales Amount]', '[Month Number]'].map(
  (name) => ({ name })
);

const rows = MONTHS.flatMap((month, m) =>
  ['North', 'South'].flatMap((region) =>
    PRODUCTS.map((product, p) => {
      const quantity = ((m + p * 3) % 9) + 1;
      return [2026, month, region, product, quantity, quantity * (p + 1) * 15, m + 1];
    })
  )
);

const state = new URLSearchParams(window.location.search).get('state') ?? 'loaded';
const launch = { v: 1, source: 'sales_demo', filters: { region: ['North', 'South'], year: [2026] } };

const deps: Partial<HandoffDeps> = {
  launchState: () => (state === 'no-filters' ? undefined : launch),
  search: () => '',
  runQuery: () => {
    if (state === 'loading') return new Promise(() => {});
    if (state === 'error') return Promise.reject(new Error('403 Forbidden'));
    return Promise.resolve({
      status: 'success',
      table: { columns: COLUMNS, rows: state === 'empty' ? [] : rows },
    });
  },
};

createRoot(document.getElementById('root')!).render(<ExcelApp deps={deps} />);
