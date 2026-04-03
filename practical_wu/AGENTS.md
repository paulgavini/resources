# AGENTS.md

This file tracks session history and project changes so future sessions can resume quickly.

## Project Info

- Project name: `practical_wu`
- Project type: Vanilla HTML/CSS/JavaScript
- Active project path: `C:\Users\paulg\OneDrive - Department for Education\VSCode programming\practical_wu`

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

### 2026-03-28 23:40 ACDT

- Added a top-right attribution block in `index.html` to match the Oscillioscope style.
- Credit text added to header: "Made by Paul Gavini using CODEX" with a YouTube link to `https://www.youtube.com/@paulgavini`.
- Updated `css/styles.css`:
  - topbar now uses a two-column grid for desktop so credit sits in the top-right corner
  - added `.project-credit` styles and link hover/focus styling
  - ensured `.top-controls` and `.status-row` span full width below the header row
  - added responsive behaviour at smaller widths so credit shifts to left-aligned and stacked layout.

### 2026-03-28 23:44 ACDT

- Added a dedicated usage guide page: `instructions.html`.
- The guide includes:
  - project purpose and quick-start workflow
  - table-based explanation of all top header controls/buttons
  - section navigation behaviour
  - explanation of every section-level button (add/remove/regenerate controls)
  - notes on research question validation, graph preview, saving, and compatibility.
- Added a new top control link button in `index.html`:
  - `Instructions` (opens `./instructions.html` in a new tab).
- Updated `css/styles.css`:
  - added `.button-link` styles so anchor links can look/behave like toolbar buttons
  - added `.button-link.secondary` and keyboard focus-visible styles for accessibility.

### 2026-03-28 23:45 ACDT

- Removed the sentence "Classroom guide for students and teachers in South Australia." from the header of `instructions.html` as requested.

### 2026-03-28 23:52 ACDT

- Fixed GitHub Pages display issue where the `Instructions` control appeared as a plain hyperlink.
- Updated `index.html`:
  - replaced the header `Instructions` anchor link with a standard `<button>` using `data-action="open-instructions"` and existing `.secondary` button styling.
- Updated `js/app.js`:
  - added `open-instructions` action handler to open `./instructions.html` in a new tab.
  - includes fallback to same-tab navigation if popup opening is blocked.

### 2026-03-29 09:12 ACDT

- User reported dynamic form inputs losing focus after each typed character in sections 4-8.
- Updated `js/app.js`:
  - added active-field snapshot/restore helpers for bound inputs, dynamic array rows, and data table cells.
  - `renderApp()` now captures the current focused field (including cursor position) before rerender and restores it after rerender.
- Result: typing can continue normally in variables, risk, materials, method, and data-table inputs without re-clicking per character.

### 2026-03-29 09:21 ACDT

- User requested implementation of true Word export (`.docx`).
- Updated `index.html`:
  - added `Export Word` button in top controls with `data-action="export-word"`.
  - added browser CDN script for `docx` library (`jsdelivr`).
- Updated `js/app.js`:
  - added `export-word` action handler.
  - integrated chart snapshot reuse for Word export so the generated document can include the current graph image.
  - refactored chart snapshot logic into a shared helper.
- Added `js/word-export.js`:
  - builds and downloads a formatted `.docx` report using the app state.
  - includes setup, question, hypothesis, variables, risk table, materials, method, data table, analysis graph (when available), evaluation, and conclusion.
- Updated docs:
  - `README.md` now lists `.docx` export support and the new module.
  - `instructions.html` header controls table now includes `Export Word`.

### 2026-03-29 09:37 ACDT

- User requested all trendline options plus `R^2` displayed as a percentage.
- Updated `index.html`:
  - added analysis dropdown `Trendline` with options:
    - none, linear, quadratic, exponential, logarithmic, power, moving average.
- Updated `js/state.js`:
  - added `analysis.trendlineType` default (`none`).
  - added trendline type normalisation guard for imported/legacy data.
- Rebuilt `js/charts.js` trendline engine:
  - added line/scatter trendline overlays for all requested types.
  - added regression calculations for linear, quadratic, exponential, logarithmic, and power.
  - added moving-average trendline (3-point window with automatic fallback for short data series).
  - added `R^2` calculation and status display as a percentage.
  - for non-numeric X in line charts, regression uses row order and reports this in status.
  - for bar charts, trendlines are not applied and status explains why.
- Updated docs:
  - `README.md` now documents trendline support and `R^2` percentage output.
  - `instructions.html` now explains trendline choices and `R^2` display in the graph section.

### 2026-03-29 09:41 ACDT

- User requested graph status to also show trendline equation and standard deviation.
- Updated `js/charts.js`:
  - trendline builders now generate equation strings for:
    - linear, quadratic, exponential, logarithmic, power, moving average.
  - added residual standard deviation calculation for each trendline fit.
  - graph status now reports:
    - equation
    - standard deviation (SD)
    - `R^2` percentage.
- Updated docs:
  - `README.md` now notes equation + SD + `R^2` in graph status.
  - `instructions.html` graph section updated to mention equation, SD, and `R^2`.

### 2026-03-29 09:46 ACDT

- User requested equation/SD/`R²` output to be displayed in the graph area and to use superscript formatting for 2.
- Updated `js/charts.js`:
  - added a chart overlay plugin that draws the fitted summary text inside the graph canvas area.
  - added summary text builder in the requested style:
    - `Equation: ... SD: ... R²: ...`
  - switched trendline status label formatting from `R^2` to `R²`.
  - included compatibility fallback for browsers without `canvas.roundRect`.
- Updated docs:
  - replaced `R^2` references with `R²` in `README.md` and `instructions.html`.

### 2026-03-29 09:49 ACDT

- User requested moving the equation/SD/`R²` display to sit under the x-axis variable label.
- Updated `js/charts.js`:
  - repositioned summary drawing from top-left overlay to centered text below the x-axis label.
  - added bottom layout padding when summary text is present so text does not overlap/clamp.
- Updated docs:
  - `README.md` and `instructions.html` now describe the summary position as below the x-axis label.

### 2026-03-29 09:51 ACDT

- User requested removing trendline details from the text status under the graph.
- Updated `js/charts.js`:
  - graph status message now only reports the base graph update/error state.
  - removed trendline-specific status text (trendline fit details remain displayed in-graph below the x-axis label).

### 2026-04-03 22:05 ACDT

- Resumed the project from the current Windows workspace.
- Read `AGENTS.md`, `README.md`, top-level HTML/CSS files, and all JS modules to rebuild edit context before making changes.
- Updated `AGENTS.md` metadata:
  - corrected the active project path
  - refreshed the current file list to match the actual workspace contents
- No application files were changed in this session.

### 2026-04-03 22:29 ACDT

- User requested a new multi-graph workflow in section 9 first, followed by support for plotting multiple Y-axis columns on the same graph.
- Updated analysis UI and state:
  - replaced the single graph controls with dynamic graph cards
  - added `Add graph` and delete support for extra graphs
  - changed analysis graph config from single `xColumn` / `yColumn` fields to `analysis.graphs[]` with per-graph `graphType`, `trendlineType`, `xColumn`, and `yColumns`
  - legacy single-graph data is normalised into the new structure during load/import
- Updated chart rendering:
  - added support for multiple charts on the page at once
  - added support for multiple Y-axis datasets on one graph using distinct colours
  - enabled chart legends when multiple series or a trendline are present
  - excluded the chosen X-axis column from Y-axis choices
  - limited trendlines to graphs with a single selected Y-axis column
- Updated preview/export:
  - live report preview now renders all analysis graphs
  - Word export now includes all rendered graphs
- Updated templates and user-facing docs:
  - starter templates now use the new graph config structure
  - `instructions.html` and `README.md` were updated for the new graph workflow
- Verified all JS modules with a parse-only Node VM module syntax check.

### 2026-04-03 22:35 ACDT

- User requested an additional calculated standard deviation column option in section 8 alongside the existing average column.
- Updated data table/state behavior:
  - added `data.includeStandardDeviation`
  - added a new section 8 checkbox for the calculated standard deviation column
  - extended shared display-column logic so average and standard deviation can both appear in the data table and graph selectors
- Updated output/rendering:
  - live data table now renders computed columns through shared chart display helpers
  - report preview and Word export now include the standard deviation column when enabled
- Updated docs:
  - `README.md` now mentions optional average and standard deviation columns
  - `instructions.html` now documents the average / standard deviation checkboxes
- Verified all JS modules again with a parse-only Node VM module syntax check.

### 2026-04-03 22:41 ACDT

- User requested a graph option checkbox in section 9 to force the graph to start at `0,0`.
- Updated analysis graph config/state:
  - added per-graph `startAtOrigin`
  - graph cards now include a `Force graph to start at 0,0` checkbox
- Updated chart rendering:
  - when enabled, Y-axis is forced to start at `0`
  - X-axis is also forced to start at `0` for scatter graphs, where the X scale is numeric
  - graph status text now notes the X-axis limitation for non-scatter graphs
- Updated docs:
  - `README.md` and `instructions.html` now mention the new graph-origin option
- Verified all JS modules again with a parse-only Node VM module syntax check.

### 2026-04-03 22:44 ACDT

- User reported that the Y-axis started at `0` but the X-axis still started at the minimum data value.
- Updated `js/charts.js` so line graphs with numeric X values now use a linear X-axis instead of a category X-axis.
- Result:
  - `Force graph to start at 0,0` now forces X to `0` for:
    - scatter graphs
    - line graphs with numeric X values
  - non-numeric/category X-axis graphs still only force Y to `0`
- Updated wording in `README.md` and `instructions.html` to explain the numeric-X behaviour.
- Verified all JS modules again with a parse-only Node VM module syntax check.

## Current File List

- `AGENTS.md`
- `README.md`
- `css/print.css`
- `css/styles.css`
- `index.html`
- `instructions.html`
- `js/app.js`
- `js/charts.js`
- `js/report.js`
- `js/state.js`
- `js/storage.js`
- `js/templates.js`
- `js/ui.js`
- `js/validation.js`
- `js/word-export.js`

## Entry Template

Use this for future updates:

```md
### YYYY-MM-DD HH:MM TZ

- What was requested
- What changed (files and behavior)
- Any blockers, assumptions, or pending work
```
