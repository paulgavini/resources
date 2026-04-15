# Current State

Date captured: `2026-04-10`

## Project

- Project folder: `math_inv`
- Type: standalone HTML/CSS/JavaScript browser app
- Purpose: build formal mathematics investigation reports based on the mathematics report PDF
- Asset source: local vendor files copied from `tabulator_chart_resource`

## Implemented Behaviour

- The app is structured around:
  - investigation setup
  - introduction
  - mathematical investigation
  - data tables
  - graphs
  - analysis
  - conclusion
  - export
- Styling is minimalist and technical:
  - full-width layout
  - black/white/light-blue palette
  - flat surfaces
  - 1px borders
  - compact spacing
- The live report preview can be disabled and re-enabled.
- When preview is disabled, the middle editor area expands.
- When preview is re-enabled, the editor/data area is resized back before the data grid is rendered.

## Toolbar

- `Instructions`, `Apply template`, and `Clear all` remain text buttons.
- File/report actions are icon buttons:
  - save
  - load
  - export JSON
  - import JSON
  - print/PDF
  - preview toggle
  - export Word
- Icon buttons include:
  - `aria-label`
  - hidden text for screen readers
  - visible CSS tooltip on hover/focus
- The preview icon changes between enabled and disabled states.
- Toolbar icon actions now respond correctly when the user clicks the SVG icon itself, not just the button padding/text.
- `Instructions` now opens `instructions.html` in a separate tab without also redirecting the main builder tab.

## Save/Load

- Autosave runs every 15 seconds.
- Saved work loads automatically when the app opens or refreshes.
- Manual `Save` still forces an immediate write.
- Manual `Load` still reloads the most recent saved version while the app is already open.

## Data Section

- Default table size is 3 rows.
- Row count field was removed from the UI.
- `Add column` and `Add trial column` sit below the column settings list.
- `Add row` sits below the data table.
- Average and standard deviation checkboxes remain at the top of the data section.
- Column-definition rows now use `Sortable` drag handles so data-entry headings can be reordered directly in Section 4.
- Reordering a column also remaps:
  - the underlying row values in the Tabulator data grid
  - graph column references for X-axis, Y-axis, and bubble-radius selections

## Graphs

- Available chart types:
  - `line`
  - `scatter`
  - `bar`
  - `bubble`
  - `pie`
  - `doughnut`
  - `polarArea`
  - `radar`
- Bubble charts support a separate radius column.
- Trendlines are available only for line and scatter charts.

## Mathematical Notation

- Automatic parsing is implemented for superscript/subscript notation.
- Supported input examples:
  - `x^2`
  - `x_1`
  - `x^{n+1}`
  - `x_(i+1)`
- This parsing is used in:
  - introduction preview
  - conclusion preview
  - live report preview
  - Word export

## Word Export

- Word export now uses:
  - Calibri 10 as the base font
  - 1.27 cm page margins on all sides
- These defaults are applied in `js/word-export.js` through both document-level defaults and explicit text runs.

## Instructions

- `instructions.html` has been updated to match the current UI:
  - icon toolbar explanation
  - autosave/autoload explanation
  - preview toggle explanation
  - 3-row default and `Add row`
  - notation examples
- The guide is now written as a standalone first-use help page for students in Years 7 to 12.
- References to the source PDF were removed from the visible guide text.
- The instructions-page header no longer shows the project-source note or the extra `Open The Builder` link.

## Status Badges

- Sidebar badges use:
  - light green for `Complete`
  - pale red for `Incomplete`

## Important Files

- `index.html` - page structure and toolbar
- `instructions.html` - user guide
- `css/styles.css` - interface styling
- `css/print.css` - print layout
- `js/app.js` - app controller
- `js/state.js` - default state and normalisation
- `js/ui.js` - DOM rendering and UI helpers
- `js/charts.js` - graph rendering
- `js/report.js` - live HTML report output
- `js/word-export.js` - `.docx` export
- `js/math-notation.js` - superscript/subscript parsing

## Verification Status

- A live browser smoke test was run on `2026-04-10`.
- Verified in browser:
  - preview toggle disables and re-enables the live report panel
  - manual `Save now` works
  - autosave persists changes and reload restores them
  - math notation renders correctly in the conclusion preview and live report preview
  - the populated mobile-plan template renders a live line graph
  - dragging a Section 4 column row reorders the column settings list, data table headings/cells, and graph selectors together
  - clicking `Instructions` opens a single new instructions tab while the builder remains on `index.html`
- Verified by generated `.docx` XML inspection:
  - Word export serialises 1.27 cm page margins (`720` twips)
  - Word export serialises Calibri 10 as the default run formatting
- Remaining unverified flows:
  - JSON export/import download flow
  - Word export download/output formatting
  - print/PDF output
  - exhaustive graph-type sweep across all chart modes

## Resume Utilities

- `session_resume_2026-04-10/local_server.js` is a small local static server used to smoke-test the app over `http://127.0.0.1:8765` when browser automation cannot load `file://` URLs directly.
