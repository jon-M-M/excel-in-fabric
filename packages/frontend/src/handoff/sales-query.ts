// Builds the DAX query that fills the sheet for the report's filters.

import type { LinkFilters } from './link-filters';

export const SHEET_COLUMNS = [
  'Year',
  'Month',
  'Region',
  'Product',
  'Quantity',
  'Sales Amount',
] as const;

function daxString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function treatas(values: (string | number)[], column: string): string {
  const list = values.map((v) => (typeof v === 'number' ? String(v) : daxString(v)));
  return `TREATAS({${list.join(', ')}}, ${column})`;
}

export function buildSalesQuery(filters: LinkFilters): string {
  const filterArgs = [
    filters.region && treatas(filters.region, "'Region'[Region]"),
    filters.year && treatas(filters.year, "'Date'[Year]"),
    filters.category && treatas(filters.category, "'Product'[Category]"),
  ].filter((arg): arg is string => Boolean(arg));

  const summarizeArgs = [
    "'Date'[Year], 'Date'[Month Number], 'Date'[Month], 'Region'[Region], 'Product'[Product]",
    ...filterArgs,
    '"@Quantity", [Quantity]',
    '"@Sales", [Sales Amount]',
  ];

  return [
    'EVALUATE',
    'SELECTCOLUMNS(',
    `    SUMMARIZECOLUMNS(\n        ${summarizeArgs.join(',\n        ')}\n    ),`,
    `    "Year", 'Date'[Year], "Month", 'Date'[Month], "Region", 'Region'[Region], "Product", 'Product'[Product],`,
    `    "Quantity", [@Quantity], "Sales Amount", [@Sales], "Month Number", 'Date'[Month Number]`,
    ')',
    'ORDER BY [Year], [Month Number], [Region], [Product]',
  ].join('\n');
}
