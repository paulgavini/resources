# Mathematics Investigation Builder

`math_inv` is a standalone browser app for drafting formal mathematics investigation reports.

It is based on `practical_wu`, adapted to the mathematics report structure in `HowToWriteAMathematicsReport (1).pdf`, and uses local assets copied from `tabulator_chart_resource`.

## What it does

- Guides students through:
  - investigation setup
  - introduction
  - mathematical investigation cycles
  - data tables
  - graphs
  - analysis
  - conclusion
  - export
- Uses a local Tabulator table for data entry.
- Uses local Chart.js for graphs.
- Uses local SortableJS for reordering investigation cycles.
- Uses local `docx` for Word export.
- Shows a live report preview suitable for printing.
- Saves and loads work in IndexedDB with localStorage fallback.

## Run

No build step is required.

1. Open `index.html` directly in a browser, or
2. Use a local static server / Live Server for the folder.

Open `instructions.html` for the report structure guide and sentence starters.

## Key files

- `index.html` - maths investigation layout
- `instructions.html` - report guidance derived from the PDF
- `css/styles.css` - interface styling plus Tabulator overrides
- `css/print.css` - print/PDF styling
- `js/app.js` - app controller and event wiring
- `js/state.js` - state model and normalisation
- `js/ui.js` - DOM rendering and Tabulator table rendering
- `js/report.js` - live report HTML generation
- `js/word-export.js` - Word export generation
- `js/templates.js` - maths investigation starter templates
- `vendor/` - local runtime assets copied from `tabulator_chart_resource`
