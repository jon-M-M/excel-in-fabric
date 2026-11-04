# Excel in Fabric — design

> Design notes written with Claude Code while the app was being built, kept as a record of the decisions.
> They mention the original workspace and a livestream demo; the setup steps that apply to you are in the README.

Date: 2026-10-19. Status: draft for approval.

## Intent

A segment in a livestream demo of Fabric Apps, for an audience already interested in Fabric Apps. Jon shares his
screen and opens with the anecdote: every report gets the question "can I export this to Excel?", so he decided to
bring the one feature Fabric and Power BI were missing — *Excel in Fabric*. The reveal gets the laugh; the rest
should make the audience think "wait, a Fabric app can do *that*?".

It is a joke played straight: the app must look convincingly like Excel at a glance and actually work for the few
minutes it is on screen. It is a one-off demo, not a product.

## Demo flow (agreed)

1. A normal-looking Power BI report: sales by region and product, with a slicer or two.
2. Jon filters it (e.g. Region = North, Year = 2026) and clicks a big **Export to Excel** button.
3. The Excel in Fabric app opens with the same slice of data in an Excel-looking grid: ribbon, column letters, row
   numbers, the green look. The app fetches the data itself from the semantic model, using the filters carried in
   the link.
4. Jon plays with it: types a formula such as `=SUM(C2:C20)`, edits a cell, maybe sorts.
5. File → Export to a real `.xlsx`, which opens in real Excel. Punchline: Excel → Fabric → Excel.
6. Backup path: File → Open CSV (a CSV exported from the visual), in case the report path misbehaves live.

## Goals

- The report → app handoff works live, from inside the Fabric portal, with the report's filters applied.
- The app reads at a glance as Excel: green title bar, ribbon with tabs (only Home needs working buttons), name box
  and formula bar, column letters, row numbers, gridlines, sheet tab at the bottom, selected-cell outline.
- Cell editing and basic formulas work reliably: cell references, ranges, `+ - * /`, parentheses, and `SUM`,
  `AVERAGE`, `MIN`, `MAX`, `COUNT`. Formulas recalculate when an input changes.
- Export produces a real `.xlsx` that opens cleanly in Excel, with formulas kept as formulas (not just values).
- File → Open CSV loads a CSV into the grid.

## Non-goals (v1)

- Saving anything into Fabric (no data service, no storage).
- Multiple sheets, charts in the app, conditional formatting, cell styling beyond what the demo needs.
- A full Excel formula language; anything beyond the list above.
- Large data: the demo slice is at most a few hundred rows; the app caps a load (e.g. 5,000 rows) and says so.
- Mobile layout.

## Anti-goals (failure even if it technically works)

- Anything that can break or stall on stage without a visible reason: an endless spinner, a blank grid, a silent
  failed query. Every failure shows a clear Excel-style error dialog, and the CSV path is always available.
- Looking like a generic web data grid rather than Excel — the joke depends on the look.
- Secrets or tokens in the link, the repo or the KB.

## Parts

### 1. Spike first (throwaway): do link parameters survive sign-in?

Before building anything else: deploy a page that prints its query string and, if available, the Fabric deep-link
launch state (`@microsoft/rayfin-app-state-fabric`, `isSupported()` / `getLaunchStateSync()`). Open it via a link
with parameters, both by the direct hosting URL and via the Fabric portal. The result picks the handoff mechanism:

- **Preferred if it works:** a Fabric portal link carrying deep-link state (the app stays inside the portal frame).
- **Otherwise:** the direct hosting URL with query parameters (`?region=North&year=2026`).
- **If neither survives sign-in:** the app saves the query string to `sessionStorage` before the sign-in redirect
  and restores it after; if that also fails, the demo falls back to CSV.

Spike code is labelled throwaway and removed afterwards.

**Result (2026-10-19, Rayfin 1.36.2, probe deployed to `excel_in_fabric`):**

- A — hosting URL `/?region=North&year=2026`, fresh private window: the query string survived sign-in
  (captured and current URL both kept it). Deep-link support: not supported (not embedded), as expected.
- B — Fabric portal link: deep-link support `{"version":1,"maxEncodedBytes":4096,"maxDepth":20,"canPush":true}`;
  `setState` wrote; the portal address bar gained `&extensionScenario=openArtifact&fabricAppState=v1.<base64url of
  the JSON>` (here `v1.eyJyZWdpb24iOiJOb3J0aCIsInllYXIiOjIwMjZ9` = `{"region":"North","year":2026}`).
- C — that address in a fresh private window: the portal's own sign-in stripped `fabricAppState` from the address,
  so no launch state. In a signed-in window: launch state `{"region":"North","year":2026}` arrived.
- D — portal link with `&region=North`: the portal does not forward extra query parameters to the app.

**Decision: portal deep-link state.** The `Excel Link` measure builds the portal link
`https://app.fabric.microsoft.com/groups/<workspace>/appbackends/<app item>?ctid=<tenant>&experience=power-bi&extensionScenario=openArtifact&fabricAppState=v1.<base64url(JSON)>`,
so the demo stays inside the Fabric portal. The app reads `getLaunchStateSync()`; it also accepts the same keys
from the query string, so the direct hosting URL works as a fallback. Caveat: a viewer not yet signed in to Fabric
loses the state at the portal's sign-in; on stage Jon is signed in. The base64url encoding must be done in DAX; if
that proves impractical in Phase 2, the measure builds the direct hosting URL with a query string instead (proven
by row A).

**Risk: the portal link format is observed, not documented.** The SDK marks `fabricAppState` and `v1.` as internal
("apps read launch state through the client, never by parsing the URL"), and `experience=power-bi` /
`extensionScenario=openArtifact` were copied from the address bar. A portal update could change them without
notice. So:

- Phase 2 opens one DAX-built link in the portal before building further on it, and checks that the state arrives:
  unpadded base64url, a plain JSON object, `year` as a number, and multi-select values as arrays of strings.
- Member names used in the link (regions, categories) are ASCII only, so the DAX encoder never has to produce
  UTF-8 multi-byte sequences.
- The hosting-URL query string (row A) is also the fallback if the portal link stops working, not only if DAX
  base64 is impractical; the rehearsal (Phase 5) includes a portal-link smoke test, and the report keeps a second,
  small "direct link" button using the hosting URL.

### 2. Demo semantic model and report (built by Claude)

In a Fabric workspace of its own (`excel_in_fabric_dev` in the original build).

- Semantic model `sales_demo`, import mode, data generated inside the model by DAX calculated tables, so there is
  no lakehouse or pipeline. It is a plain star schema; table names inside the model are human-readable instead of
  `dim_`/`fact_`.
- Tables: `Date` (2025-01-01 to
  2026-12-31), `Product` (about 20 products in 4 categories), `Region` (North, South, East, West, with a few cities
  each), `Sales` (a few thousand rows: date, product, region, quantity, sales amount). Values are fictional,
  deterministic (same data on every refresh) and ASCII only.
- Measures: `Sales Amount`, `Quantity`, plus one measure `Excel Link` that builds the app URL from the current
  filter context (selected regions, years, categories), with data category Web URL.
- Report `sales_demo`, one page: slicers for year, region and product category, a matrix (product × region, sales amount), a
  column chart, and a large **Export to Excel** button whose Web URL action uses `Excel Link`. Styled plainly and
  professionally — it must look like a real report people would want to export.
- Built as TMDL and PBIR definitions in this repo (`fabric/`), deployed with `fab import`.
- **Verified 2026-10-19:** model `sales_demo` deployed and refreshed; a DAX check script (not included here) passed 15/15
  (including base64url for JSON lengths ≡ 0, 1, 2 mod 3). A DAX-built `Excel Link` (North + South, 2026) opened in a
  signed-in portal window delivered launch state
  `{"v":1,"source":"sales_demo","filters":{"region":["North","South"],"year":[2026]}}` to the app.

### 3. The app (Rayfin, existing scaffold)

- **Connector:** `rayfin connector add --type fabric-semanticmodel` for `sales_demo`, operations limited to
  `executeQuery`, delegated auth (runs as the signed-in user). Prerequisites, checked 2026-10-19: the tenant
  settings "Semantic Model Execute Queries REST API" and "Enable Fabric App Items (preview)" are both on; Jon owns
  the model, so he has Build + Read.
- **Handoff:** on start, read the filters from the link (mechanism from the spike). Treat them as untrusted input:
  accept only known parameter names, and only values that exist in the model (checked by a lookup query or a fixed
  list); never paste raw link text into DAX. Then run one DAX query (`SUMMARIZECOLUMNS` over date, product and
  region columns with the filters applied) and load the result into the grid with a header row, starting at A1.
- **Grid:** an Excel-like sheet component built for this app (no data-grid library — the look matters more than
  features). Columns A–Z, rows 1–(data + 50). Click to select, arrow keys and Enter/Tab to move, type to edit,
  formula bar shows the raw formula of the selected cell, name box shows the address. Click a column letter to sort
  by that column (header row stays put).
- **Formulas:** a small evaluator written for this app: numbers, strings, cell references, ranges, `+ - * /`,
  parentheses, unary minus, and `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`. Errors show as `#REF!`, `#DIV/0!`,
  `#NAME?`, `#VALUE!`, and circular references as `#CIRC!`. Tested thoroughly — it is the part most likely to go
  wrong live.
- **Ribbon:** tabs File, Home, Insert, Page Layout, Formulas, Data, Review, View. Only File and Home need to work;
  other tabs show plausible but inert buttons (a joke tooltip is fine). File menu: Open CSV…, Export to Excel
  (.xlsx). Home: AutoSum (inserts `=SUM(...)` over the numbers above), sort A→Z / Z→A.
- **Export:** a library-generated `.xlsx` (ExcelJS) with values, formulas (with cached results), a bold header row
  and sensible column widths. Filename like `sales_north_2026.xlsx`. The download mechanism (blob link) is already
  proven inside the Fabric portal.
- **Open CSV:** file picker, a standard CSV parser (quotes, commas in values), numbers detected.
- **Errors:** a connector or query failure shows an Excel-style dialog with the reason and an "Open CSV instead"
  button. No endless loading states.
- **No filters received:** when the app opens with neither launch state nor query-string filters (e.g. a viewer who
  was not signed in to Fabric lost the state at the portal's sign-in), it says so plainly — "No filters came
  through from the report" — rather than silently loading an unfiltered sheet; it offers "Load all data" and
  "Open CSV".
- **Verified 2026-10-19 (Phase 3, deployed):** report Year 2026 + Region North, South → Export to Excel opened the
  app in the portal with `Region: North, South · Year: 2026` and 480 rows (last row 2026, Dec, South, Wheel); no
  slicers → all rows (first 2025 Jan East Bottle, last 2026 Dec West Wheel); plain portal link → "No filters came
  through from the report" and Load all data works; Direct link with Category Bikes → Bikes only; a portal link
  with its last character removed → the no-filters notice (the SDK drops state it can't decode), never a silent
  unfiltered sheet.
- **Sign-in flash (for Phase 4):** opened inside the portal, the template's "Welcome back — Sign in with Microsoft"
  card shows for a second or two until the embedded Fabric sign-in completes on its own. Inside the portal
  (`fabricEmbedded=true`), show an Excel-style "Starting Excel in Fabric…" splash instead, and offer the sign-in
  button only if the embedded sign-in actually fails.
- **Verified 2026-10-19 (Phase 4, deployed):** Export to Excel (North + South, 2026) → splash, then the sheet titled
  `sales_north_south_2026 - Excel in Fabric`, no sign-in card flash; AutoSum in F482 → 880362 with
  `=SUM(F2:F481)`; `=F482/2` in G482 updated after editing F2; clicking the F column letter sorted ascending then
  descending with the header and the total row in place; the plain portal link showed the Excel dialog "No
  filters came through from the report" and Load all data filled the sheet. (Direct link with no slicers set
  loads all rows without a dialog, as designed: the link carries an empty filter set.)
- **Verified 2026-10-19 (Phase 5, deployed — full demo):** Export to Excel → 480 rows; AutoSum 880362 and
  `=F482/2`; File → Export to Excel downloaded `sales_north_south_2026.xlsx`, which opened cleanly in desktop
  Excel with the formulas kept; a CSV from the matrix's Export data loaded through File → Open CSV…; the same CSV
  loaded from the no-filters dialog's Open CSV.

## Constraints

- Fabric Apps (preview) on Rayfin 1.36.2, all `@microsoft/rayfin-*` packages pinned exactly. Rayfin CLI is local to
  this project only (`npx rayfin`).
- The livestream was planned for the end of October 2026. Everything was built and tested on a Fabric trial
  capacity in Central US.
- Demo-ready (handoff, grid, formulas, export, CSV backup) with a few days to spare before the stream for a full
  rehearsal from inside the Fabric portal; polish comes after the core path works end to end.
- Auth: Fabric SSO only; assets protected (sign-in and app permission required).
- Demo browser: a profile signed in to only one Microsoft account. With a second Microsoft account
  signed in, opening the portal link shows Microsoft's "Pick an account" prompt; with one account it passes
  silently (verified 2026-10-19).
- No secrets in the repo; the publishable key stays in git-ignored `rayfin/.env`.
- Tests: TDD for the formula evaluator, CSV parsing, link/filter validation and the xlsx export; the existing template
  test suite keeps passing.

## Calls Claude made (check these)

- Hand-built grid and formula evaluator instead of libraries (HyperFormula is GPL/commercial; a data-grid library
  would look like a data grid, not Excel).
- ExcelJS for `.xlsx` export (MIT, writes formulas).
- Demo data generated by DAX calculated tables (the exception noted above).
- Only File and Home do anything; other ribbon tabs are decoration.
- Grid is A–Z; row cap 5,000.

## Left to the builder

- Exact visual styling of the ribbon and grid (match Excel's current look as closely as practical).
- DAX for data generation and for the `Excel Link` measure.
- Component structure, state management and file layout within `packages/frontend`.
- Exact demo data values and product/region names.
