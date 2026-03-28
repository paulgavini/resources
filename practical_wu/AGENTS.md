# AGENTS.md

This file tracks session history and project changes so future sessions can resume quickly.

## Project Info

- Project name: `practical_wu`
- Project type: Vanilla HTML/CSS/JavaScript
- Active project path: `/home/paul/Downloads/resources-main/practical_wu`

## Resume Workflow

1. Read this file first.
2. Confirm current files and status.
3. Append a new session entry after completing changes.
4. Keep entries short, concrete, and timestamped.

## Session Log

### 2026-03-28 22:38 ACDT

- User requested a new project in `/practical_wu`.
- Creation at filesystem root failed due sandbox permissions.
- Elevated write request for `/practical_wu` was rejected.
- Project was created in workspace at `/home/paul/Downloads/resources-main/practical_wu`.
- Initial files created: `README.md`, `.gitignore`.

### 2026-03-28 22:39 ACDT

- User confirmed this should be an HTML, JS, CSS project.
- Added `index.html`.
- Added `style.css`.
- Added `script.js`.
- Updated `README.md` with file list and run instructions.

### 2026-03-28 22:40 ACDT

- Added `AGENTS.md` to track changes and support session resume.
- Documented all known prior actions in this file.

### 2026-03-28 23:00 ACDT

- User requested a complete MVP called "Practical Investigation Builder" for South Australian science classes.
- Rebuilt project into modular SPA structure with:
  - `index.html`
  - `css/styles.css`
  - `css/print.css`
  - `js/app.js`
  - `js/state.js`
  - `js/ui.js`
  - `js/storage.js`
  - `js/templates.js`
  - `js/validation.js`
  - `js/report.js`
  - `js/charts.js`
- Implemented all required sections:
  - setup, research question, hypothesis, variables, risk, materials, method, data, graph/analysis, evaluation, conclusion, export.
- Added dynamic lists and tables:
  - controlled variables
  - risk rows
  - materials
  - method steps with drag-and-drop reorder
  - configurable data columns/rows and editable data grid
- Added charting using Chart.js:
  - line, scatter, and bar graphs
  - selectable x/y columns from entered data
- Added local persistence features:
  - save/load with localStorage
  - autosave timer
  - export JSON
  - import JSON
  - clear-all with confirmation
- Added three built-in templates:
  - effect of temperature on reaction rate
  - friction on different surfaces
  - cooling rate investigation
- Added live report preview and print CSS for clean PDF output.
- Updated `README.md` with full usage and project structure docs.
- Removed legacy starter root files `script.js` and `style.css`.

### 2026-03-28 23:09 ACDT

- Added a rule-based research question heuristic validator in `js/validation.js`.
- Implemented scoring output format:
  - `score`
  - `level` (`blank`, `too-vague`, `needs-improvement`, `good`)
  - `warnings`
  - `positives`
- Added teacher-editable constants for:
  - question starters
  - relationship words
  - measurable terms
  - vague words
- Added nuanced handling for `more`/`less` so they are only penalised when not tied to measurable context.
- Updated `js/ui.js` to render live status with:
  - green (`good`)
  - amber (`needs-improvement`)
  - red (`too-vague`/`blank`)
  - score, strengths, and actionable suggestions.
- Added research question examples helper block in `index.html` (weak/better/strong).
- Added CSS for validation states and feedback list styling in `css/styles.css`.
- Updated `README.md` with a brief validator explanation and the 6 requested test case expectations.

### 2026-03-28 23:14 ACDT

- Fixed missing graph in live report preview.
- Updated `js/report.js`:
  - `buildReportHtml` now accepts options (`chartImageUrl`, `chartStatus`)
  - analysis section now renders a graph image block when available.
- Updated `js/app.js`:
  - chart now renders before report HTML generation
  - graph canvas is captured via `toDataURL()` and passed into report preview.
- Updated styles in:
  - `css/styles.css` for report graph block/image/note
  - `css/print.css` so graph image prints cleanly.

### 2026-03-28 23:16 ACDT

- Fixed intermittent blank graph snapshot in report preview.
- Updated `js/charts.js`:
  - disabled chart animation for deterministic capture
  - forces `chartInstance.update("none")` before snapshot
  - returns `imageDataUrl` from Chart.js `toBase64Image()`.
- Updated `js/app.js`:
  - report preview now prioritises `chartResult.imageDataUrl` and only falls back to canvas `toDataURL`.

### 2026-03-28 23:18 ACDT

- Fixed missing units on graph axes.
- Updated `js/charts.js`:
  - added `formatAxisTitle(column)` helper
  - x-axis and y-axis titles now show units as `Name (unit)` when unit is present.
- This applies to both:
  - the live graph in the analysis section
  - the graph image shown in report preview/print.

### 2026-03-28 23:28 ACDT

- Switched app persistence from localStorage-first to IndexedDB-first.
- Replaced storage layer in `js/storage.js`:
  - added IndexedDB database/store setup
  - save/load/clear now use IndexedDB
  - added one-time legacy localStorage migration helper
  - retains localStorage fallback only if IndexedDB is unavailable.
- Updated async persistence flow in `js/app.js`:
  - save/load/clear actions now await IndexedDB operations
  - autosave now writes asynchronously with in-progress guard
  - initial load now performs migration check + IndexedDB load
  - status messages updated to reference browser database / IndexedDB.
- Updated `README.md` to document IndexedDB usage and migration.

## Current File List

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `css/print.css`
- `css/styles.css`
- `index.html`
- `js/app.js`
- `js/charts.js`
- `js/report.js`
- `js/state.js`
- `js/storage.js`
- `js/templates.js`
- `js/ui.js`
- `js/validation.js`

## Entry Template

Use this for future updates:

```md
### YYYY-MM-DD HH:MM TZ

- What was requested
- What changed (files and behavior)
- Any blockers, assumptions, or pending work
```
