# Practical Investigation Builder (MVP)

A classroom-ready single-page web app for South Australian science practical investigations.

Students can plan, complete, analyse, and report an investigation through guided sections, while teachers can project or print a clean report view.

## What the app does

- Guides students through 12 sections:
  1. Investigation setup
  2. Research question
  3. Hypothesis / prediction
  4. Variables
  5. Risk assessment
  6. Materials
  7. Method
  8. Data tables
  9. Graph and analysis
  10. Evaluation
  11. Conclusion
  12. Report export
- Uses Australian spelling and classroom-friendly prompts.
- Uses a transparent heuristic research-question validator (rule-based, no backend, no AI judging).
- Marks section completion in the sidebar.
- Supports drag-and-drop method step ordering (SortableJS).
- Generates editable data tables with optional calculated average column.
- Draws line/scatter/bar charts from entered data (Chart.js).
- Shows a live report preview suitable for printing.
- Saves and loads investigations in `IndexedDB` (with legacy `localStorage` migration).
- Exports/imports investigation JSON.
- Supports print/PDF via browser print dialog.
- Includes 3 built-in starter templates:
  - Effect of temperature on reaction rate
  - Friction on different surfaces
  - Cooling rate investigation

## Research question heuristic validator

The Research Question section uses a score-based heuristic in `js/validation.js` via:

- `validateResearchQuestion(questionText)` -> returns:
  - `score`
  - `level` (`blank`, `too-vague`, `needs-improvement`, `good`)
  - `warnings`
  - `positives`

Scoring rules:

- Start at `0`
- Add points for:
  - question length
  - clear scientific starter phrase
  - relationship wording
  - measurable/scientific terms
  - structure resembling `How does X affect Y?`
- Subtract points for vague wording
  - `more` and `less` are only penalised when not tied to measurable context

Thresholds:

- `blank`: empty after trim
- `too-vague`: score `< 4`
- `needs-improvement`: score `4-5`
- `good`: score `>= 6`

Expected heuristic test outcomes:

1. `""` -> `blank`
2. `"What happens with heat?"` -> `too-vague`
3. `"How does heat affect dissolving?"` -> `needs-improvement`
4. `"How does water temperature affect the time taken for sugar to dissolve?"` -> `good`
5. `"Which paper towel is better?"` -> `too-vague` (may be `needs-improvement` in future list tuning)
6. `"What is the effect of concentration on reaction rate?"` -> `good`

## Run

No build tools are required.

1. Open `index.html` directly in a browser, or
2. Use VS Code Live Server on the project folder.

Optional guide:

- Open `instructions.html` for a full user guide with button-by-button explanations.

## Project structure

- `index.html` - app layout and section forms
- `css/styles.css` - responsive interface styling
- `css/print.css` - print/PDF styling
- `js/app.js` - app controller and event wiring
- `js/state.js` - state model and normalisation
- `js/ui.js` - DOM rendering utilities
- `js/storage.js` - IndexedDB save/load/migration and import/export helpers
- `js/templates.js` - starter investigation templates
- `js/validation.js` - section checks and feedback rules
- `js/report.js` - live report HTML generation
- `js/charts.js` - Chart.js graph preparation/rendering
- `AGENTS.md` - session/change tracking log

## Future extension ideas

- Multiple named investigations per student
- Rubric-aligned feedback and teacher comment mode
- Data processing helpers (gradient, percent change, uncertainty)
- CSV import/export and richer table calculations
- Offline-first packaging (PWA)
- Optional backend sync for class submissions
