# Excel in Fabric

> "Can we export that to Excel?"

Every report gets asked this. So instead of fighting it, this repo brings Excel into Fabric: a Power BI report with
a big green **Export to Excel** button that opens a Fabric app inside the portal, with an Excel-like sheet already
holding exactly the rows you filtered. You can AutoSum, sort and type formulas, then **File → Export to Excel**
saves a real `.xlsx`, formulas included. Excel → Fabric → Excel.

It started as a joke and a way to learn Fabric Apps (preview). It's shared so you can see how the pieces fit
together and spin it up in your own tenant.

> **Not a Microsoft product.** This is a fun side project built on the Fabric Apps preview, not something Microsoft
> ships or supports.

## What it does

- **Report → app handoff.** The report's **Export to Excel** button is a link built by a DAX measure. It writes the
  current slicer selections (region, year, category) as JSON, base64url-encodes them *in DAX*, and puts them in a
  Fabric app deep link. The app reads them when it opens.
- **Same data, same security.** The app queries the same semantic model as the report, as the signed-in user,
  through a Rayfin semantic model connector. The user's permissions on the model, including any row-level security,
  apply. No extracts, no copies.
- **An Excel-like sheet**, built by hand in React (no grid or spreadsheet library): ribbon, formula bar, cell
  selection, column resize, fill handle, point-and-click references in formulas, sort, AutoSum, Excel's
  Ctrl+arrow / Ctrl+Home / Ctrl+End shortcuts (with Shift to select), and a status bar with Average / Count / Sum.
- **Formulas**: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `+ - * /`, parentheses, cell references (`A1`) and ranges
  (`A1:B10`), with Excel-style errors such as `#DIV/0!`.
- **Real files in and out.** File → Export writes an `.xlsx` with [ExcelJS](https://github.com/exceljs/exceljs)
  (formulas kept, with their calculated values). File → Open loads a CSV
  ([Papa Parse](https://www.papaparse.com/)).

Limits: 26 columns (A–Z), up to 5,000 rows, and only the five functions above.

## How it works

```text
Power BI report (sales_demo)                Fabric app (this repo, deployed with Rayfin)
┌─────────────────────────────┐             ┌─────────────────────────────────────────┐
│ slicers: Year, Region, ...  │             │ 1. read the launch state from the link  │
│ [Export to Excel] button ───┼── link ───► │ 2. allow-list the keys and values       │
│   URL = DAX measure         │  (filters   │ 3. DAX query via the semantic model     │
│   'Excel Link'              │  as base64  │    connector, as the signed-in user     │
└─────────────────────────────┘   JSON)     │ 4. render the sheet; export .xlsx       │
              │                             └───────────────────┬─────────────────────┘
              └──────────── same semantic model ◄───────────────┘
```

### How the report hands over its filters

The `Excel Link` measure (in `fabric/sales_demo.SemanticModel/definition/tables/Sales.tmdl`) builds:

```text
https://app.fabric.microsoft.com/groups/<WORKSPACE_ID>/appbackends/<APP_ITEM_ID>?ctid=<TENANT_ID>
  &experience=power-bi&extensionScenario=openArtifact&fabricAppState=v1.<base64url(JSON), no padding>
```

where the JSON is, for example:

```json
{"v":1,"source":"sales_demo","filters":{"region":["North","South"],"year":[2026]}}
```

The app reads it once with `@microsoft/rayfin-app-state-fabric` and treats it as untrusted input: only known keys
(`region`, `year`, `category`) and values that exist in the model get through
(`packages/frontend/src/handoff/link-filters.ts`).

A second measure, `Excel Link Direct`, is a fallback: it opens the app's own hosting URL with the filters as a plain
query string (`?source=sales_demo&region=North&year=2026`).

## Try the sheet locally (no Fabric needed)

You need [Node.js](https://nodejs.org/en/download) 20, 22 or 24.

```sh
git clone https://github.com/jon-M-M/excel-in-fabric.git
cd excel-in-fabric
npm install          # takes several minutes the first time
npm run dev:frontend
```

Open <http://localhost:5173/preview.html>. It loads the sheet with sample rows and no sign-in, so you can try the
formulas, AutoSum, sort and the `.xlsx` export. Add `?state=no-filters`, `?state=empty`, `?state=error` or
`?state=loading` to see the other screens.

## Set it up in your own tenant

### 1. Before you start

- A Fabric capacity (a trial works) in a region where Fabric Apps is available. At the time of writing it was not
  available in Canada regions; Central US works.
- A tenant admin turns on these tenant settings:
  - **Enable Fabric App Items (preview)**
  - **Semantic Model Execute Queries REST API**
- A workspace on that capacity, where you're an Admin or Member.
- [Power BI Desktop](https://www.microsoft.com/power-platform/products/power-bi/desktop) to publish the demo model
  and report, or the [Fabric CLI](https://learn.microsoft.com/rest/api/fabric/articles/fabric-command-line-interface)
  (`fab`) if you prefer.
- Node.js 20, 22 or 24, and the repo cloned and installed as in the section above.

The Rayfin CLI is a dev dependency of this repo, pinned to 1.36.2. Run it with `npx rayfin …`; there's no need to
install it globally.

### 2. Publish the demo model and report

The model `sales_demo` generates its own fictional data with DAX calculated tables, so there's no data source to
connect.

1. Open `fabric/sales_demo.pbip` in Power BI Desktop. If Desktop asks, turn on the Power BI Project (`.pbip`) and
   TMDL preview features under **File → Options and settings → Options → Preview features**, then reopen it.
2. Select **Refresh** so the calculated tables fill.
3. Select **Publish** and pick your workspace.

In the workspace, open the `sales_demo` semantic model and copy two IDs from the browser's address bar:
`.../groups/<WORKSPACE_ID>/datasets/<SEMANTIC_MODEL_ID>/...`.

### 3. Point the app at your model

In `rayfin/rayfin.yml`, under `connectors` → `salesdemo` → `config`, replace the two zero GUIDs:

```yaml
    config:
      workspaceId: <WORKSPACE_ID>
      itemId: <SEMANTIC_MODEL_ID>
```

Optional check, which runs a query as you without deploying anything:

```sh
npx rayfin login
npx rayfin connector invoke salesdemo executeQuery --file ./inspection/smoke.query.json
```

### 4. Deploy the app

```sh
npx rayfin login     # if you haven't already
npx rayfin up --workspace-id <WORKSPACE_ID> --item-name excel_in_fabric -y
```

`rayfin up` builds the frontend, creates the Fabric app item `excel_in_fabric` and prints the app's hosting URL
(`https://<something>.webapp.fabricapps.net`). It also adds that URL to `allowedRedirectUris` in
`rayfin/rayfin.yml`, and writes deployment details and a publishable key to `rayfin/.env` and
`rayfin/.deployments.json`. Both are git-ignored; keep them out of your commits.

Open the app item in your workspace and copy the browser URL. It has the form
`.../groups/<WORKSPACE_ID>/appbackends/<APP_ITEM_ID>?ctid=<TENANT_ID>...`; you need the app item ID and tenant ID
for the next step.

### 5. Wire the button to your app

In Power BI Desktop, in the `Sales` table, edit two measures and replace the placeholders:

| Measure | Replace |
| --- | --- |
| `Excel Link` | `<WORKSPACE_ID>`, `<APP_ITEM_ID>` and `<TENANT_ID>` |
| `Excel Link Direct` | `<APP_HOSTING_URL>`, with the hosting host name only, e.g. `abc-123-centralus.webapp.fabricapps.net` |

You can also edit them in `Sales.tmdl` before opening the project. Then publish again, replacing the report and
model.

### 6. Share and try it

Anyone who uses it needs **Build** and **Read** on the semantic model and access to the app item (giving them a
workspace role covers both).

Open the `sales_demo` report, pick a year and a region or two, and select **Export to Excel**. The app opens inside
the portal with the matching rows. Select the first empty cell under **Sales Amount**, select **AutoSum**, press
Enter, then **File → Export to Excel** and open the file in Excel.

## Troubleshooting

- **"Pick an account" when the app opens.** The browser is signed in to more than one Microsoft account. Use a
  browser profile with only the account for this tenant.
- **The app opens without your filters.** Fabric app deep links are still rolling out per tenant, and a viewer who
  isn't signed in yet loses the state at the portal's sign-in. Sign in to Fabric first, or use the **Direct link**
  button (`Excel Link Direct`), whose query string survives sign-in.
- **The app shows an error loading data.** Check that the connector IDs in `rayfin/rayfin.yml` point at your model,
  that the viewer has Build on it, and that the *Semantic Model Execute Queries REST API* tenant setting is on.
- **Deep link state is capped at 4 KiB.** Selecting many values in a large model could hit it. The demo model is
  small enough not to.

## Adapting it to your own model

The demo is wired to `sales_demo`, but the shape is reusable:

- `fabric/.../Sales.tmdl`: `Excel Link JSON` decides which filters travel. `Excel Link` does the base64url
  encoding and doesn't need to change.
- `packages/frontend/src/handoff/link-filters.ts`: the allow-list of keys and values the app accepts.
- `packages/frontend/src/handoff/sales-query.ts`: the DAX query that fills the sheet.
- `rayfin/rayfin.yml` and `rayfin/connectors/`: the connector to your model. `npx rayfin connector add --help`
  shows how to add another one.

## Development

```sh
npm run dev           # Rayfin local services + frontend
npm run dev:frontend  # frontend only (Vite, http://localhost:5173)
npm test              # unit tests (Vitest)
npm run lint
npm run typecheck
npm run rayfin:up     # redeploy after changes
```

Layout:

```text
fabric/                 demo semantic model (TMDL) and report (PBIR) as a Power BI project
packages/frontend/      the app: React + Vite
  src/excel/            ribbon, grid, formula bar, dialogs
  src/sheet/            formula engine, selection, CSV import, .xlsx export
  src/handoff/          reading the link, validating filters, querying the model
rayfin/                 Rayfin app config and the semantic model connector
inspection/             sample connector queries for `rayfin connector invoke`
docs/design/            design notes written while building it
docs/rayfin-template.md the original Rayfin template README (packs, commands, validation)
.agents/, AGENTS.md     instructions and skills for coding agents, from the Rayfin template
```

## How it was built

The app was scaffolded from Microsoft's Rayfin template and built with [Claude Code](https://claude.com/claude-code)
over a few sessions. The design notes in [`docs/design/`](docs/design/) record the decisions, such as building the
grid and formula engine by hand instead of using a spreadsheet library, and the base64url encoder written in DAX.

## License

[MIT](LICENSE). Parts of this repo come from Microsoft's Rayfin app template, which is also MIT-licensed; its
copyright notice is kept in `LICENSE`. Third-party packages keep their own licenses, and the production build lists
them in `packages/frontend/dist/THIRD_PARTY_NOTICES.txt`.
