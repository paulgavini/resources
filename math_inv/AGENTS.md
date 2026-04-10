# AGENTS.md

## Project Info

- Project name: `math_inv`
- Project type: Vanilla HTML/CSS/JavaScript
- Derived from: `practical_wu`
- Local asset source: `tabulator_chart_resource/vendor`

## Current State

- The app has been reshaped for formal mathematics investigations.
- Report structure follows the attached mathematics report PDF:
  - introduction
  - mathematical investigation
  - analysis
  - conclusion
- Local vendor files are loaded from `math_inv/vendor`:
  - `tabulator.min.css`
  - `tabulator.min.js`
  - `chart.umd.min.js`
  - `Sortable.min.js`
  - `docx.umd.js`
- The data table is rendered with Tabulator.
- Graphs are rendered with Chart.js.
- Word export uses the local `docx` runtime.

## Resume Notes

- Work only inside `math_inv`.
- Do not edit `practical_wu` or `tabulator_chart_resource` when extending this project unless explicitly requested.
