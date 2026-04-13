# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the user

The user's name is Guy.

## Running the project

```bash
node server.js        # starts server (default port 3000, or set PORT env var)
npm install           # install dependencies (first time only)
```

`start.bat` sets `PORT=3001` and launches `node server.js` — used when the default project runs on 3000.

No build step, no tests, no lint config.

## Architecture

Two-dashboard, single-folder app. No bundler. All source files in the project root.

### Dashboards

| Dashboard | Tab label | Source data | Script | Style |
|---|---|---|---|---|
| Credit card expenses | נתוני אשראי | `אשראי/*.xlsx` → `data.json` | `script.js` | `style.css` |
| Current account (עו"ש) | עובר ושב | `עוש/*.xlsx` (parsed on demand) | `עוש/bank_script.js` | `עוש/bank_style.css` |

Navigation between the two dashboards is handled by `showSection()` in an inline `<script>` at the bottom of `index.html`. The bank dashboard is lazy-initialized: `initBank()` is called once when first shown.

### Credit dashboard data flow

1. `server.js` reads all `*.xlsx` files from `EXCEL_DIR` (`אשראי/`) at startup
2. Parses three Hebrew columns: `תאריך העסקה`, `בית העסק`, `סכום החיוב`
3. Deduplicates rows, sorts by date, writes to `data.json`
4. `chokidar` watches `אשראי/*.xlsx` — each `add`/`change`/`unlink` triggers a full re-read and `data.json` rewrite
5. `express` serves static files from `DIR` (`__dirname`) and exposes `/data.json` with `no-cache`
6. Browser (`script.js`) fetches `/data.json` on load and every 5 minutes

### Bank dashboard data flow

1. `GET /api/bank/list` — server reads `עוש/*.xlsx`, returns sorted list of `{ filename, sortKey, monthLabel }`
2. `GET /api/bank/:filename` — server parses one file on demand, returns `{ month, transactions[] }`
3. `bank_script.js` fetches all months at init, renders charts and tables client-side
4. xlsx files in `עוש/` are named `<Hebrew month> <YY>.xlsx` (e.g. `ינואר 26.xlsx`); `MONTH_HE` map in `server.js` converts to sort keys

### Bank dashboard column names (עוש)

| Field | Hebrew column |
|---|---|
| date | `תאריך` (Excel serial → ISO) |
| type | `סוג תנועה` |
| credit | `זכות` |
| debit | `חובה` |
| balance | `יתרה בש"ח` |
| reference | `אסמכתא` |
| description | `פירוט` |

### Credit dashboard column names

| Constant | Hebrew |
|---|---|
| `COL_DATE` | `תאריך העסקה` |
| `COL_BUSINESS` | `בית העסק` |
| `COL_AMOUNT` | `סכום החיוב` |

## Critical file-writing note

**The `עוש/` and `אשראי/` subfolders contain Hebrew characters in their names.** Write files into them via Node.js using `process.cwd()` + `path.join` rather than hardcoded paths, and copy from a temp file in the project root:

```js
// Write to temp file first, then copy
const src = path.join(process.cwd(), '_tmp.js');
const dst = path.join(process.cwd(), '\u05E2\u05D5\u05E9', 'bank_script.js'); // עוש
fs.copyFileSync(src, dst);
fs.unlinkSync(src);
```

The Write tool can write to the project root directly. For Hebrew-named subfolders use the copy approach above.

**Always strip BOM:** `fs.writeFileSync(path, content, { encoding: 'utf8' })`.

**Never use PowerShell here-strings** (`@' '@`) for JS files — they corrupt single quotes.

## Frontend libraries (CDN, no npm)

- Chart.js 4.4.2
- html2canvas 1.4.1
- jsPDF 2.5.1

PDF export in both dashboards: `html2canvas` captures the section, sliced into A4 landscape pages via jsPDF.

## bank_script.js key globals

| Variable | Purpose |
|---|---|
| `allMonthsData` | Array of all loaded months (populated by `loadAllMonths`); used by `renderAllView()` |
| `currentTxData` | Transactions currently displayed in the table (used by search/filter handlers) |
| `bankLineChart`, `bankPieChart`, `bankWeekChart`, `bankYearChart` | Chart instances — always `.destroy()` before recreating |

The dropdown's `__all__` value triggers `renderAllView()` which combines all months and switches the week bar chart to a monthly bar chart (`renderMonthlyBarChart`).
