# Graph Paper Generator — Project Memory

Use this file to resume the project in a later Codex session.

## Goal

Build a dependency-free, vanilla HTML/CSS/JavaScript square graph-paper generator for A4 and A3 paper. The app must work locally without third-party APIs, show a live result, and support accurate printing or SVG export.

## Source files

- `index.html` — interface and print-page container
- `styles.css` — minimalist responsive UI, dark mode, viewport-fit and print styles
- `app.js` — grid geometry, SVG generation, controls, export, print, zoom and theme behaviour

Do not introduce a framework, package manager, third-party API, or unnecessary project scaffolding. The app previously had generated scaffolding; it was intentionally removed.

## Current product behaviour

- Paper sizes: A4 (210 × 297 mm) and A3 (297 × 420 mm)
- Orientations: portrait and landscape
- Minimum page margin: 10–40 mm; numeric field and slider remain synchronised
- Grid spacing: 1–20 mm in 0.5 mm steps
- Presets: 2 mm, 5 mm and 10 mm
- Bold-line interval: every 1–10 cells; default every 5
- Fine-line width: 0.05–0.30 mm in 0.01 mm steps; default 0.12 mm
- Bold-line width is derived as `max(fine × 2, fine + 0.08)`, capped at 0.60 mm
- Fine-line, bold-line and paper colours are customisable
- Double-sided mode creates two matching print pages
- SVG download uses exact millimetre page dimensions
- Preview click toggles between fit-to-panel and 100% CSS print size; Enter and Space also toggle it
- Dark mode persists locally under the `graph-paper-theme` key

## Current defaults

- A4 portrait
- 10 mm minimum page margin
- 5 mm squares
- Bold line every 5 cells
- 0.12 mm fine lines
- Fine-line colour: `#B9E2FB`
- Bold-line colour: `#707070`
- Paper colour: `#FFFFFF`
- Single-sided
- Light interface theme

## Important grid rule

The grid must begin and end on bold lines in both directions and remain centred on the sheet.

`geometry()` first calculates how many cells fit inside the requested minimum margin, reduces both cell counts to complete bold-line intervals, then centres that grid. Therefore, the final physical margins may be larger than the requested minimum. If fewer cells fit than one complete bold interval, the outer edges are still explicitly classified as bold.

At the defaults, A4 portrait produces 35 × 55 cells, a 175 × 275 mm grid, 17.5 mm left/right margins and 11 mm top/bottom margins.

## Design requirements

- Strict minimalist style
- Full browser width and height
- No page or nested-panel scrolling
- Black, white and light blue interface palette
- Thin 1 px borders and 2 px corner radius
- No gradients, glass effects, glossy elements or heavy shadows
- Compact but readable settings typography (generally 11–13 px; section headings 16 px)
- Technical, calm and precise appearance
- Responsive desktop, short-window and mobile layouts
- The preview scales by both width and height to stay inside the viewport
- On small/short screens, settings reflow into a compact grid and nonessential intro/footer content collapses
- Do not restore the former “Gridcraft” name or branding

## Header details

Visible attribution:

`By Paul Gavini using CODEX · YouTube · Website`

Also present:

- `Physics guide ↗`
- Light/dark mode toggle

The YouTube, Website and Physics Guide links are visual placeholders. Their destination URLs still need to be supplied by the user. Placeholder clicks are deliberately prevented in `app.js`.

## Printing notes and limitations

- The generated SVG and print pages use exact physical millimetre dimensions.
- Dynamic print CSS requests the selected paper using `@page { size: A4/A3 portrait/landscape; margin: 0; }`.
- Browsers and printer drivers may ignore the requested page size. On macOS, the user may still need to select A3 manually from the native Paper Size menu.
- Users should choose Actual Size or 100% to preserve grid measurements.
- Duplex printing must still be enabled in the native print dialog. Use long-edge binding for portrait and short-edge binding for landscape.
- Interface dark mode must never change the selected paper or grid colours in printed/exported output.

## Running locally

Serve this directory with any static web server. For example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Research basis

- ISO A4: 210 × 297 mm
- ISO A3: 297 × 420 mm
- Common metric square-grid spacing: 5 mm, with stronger lines every 5 or 10 cells
- CSS `@page size` can request A3/A4 and orientation, but native print-dialog behaviour is browser/driver dependent

## Resume checklist

1. Read this file and inspect only `index.html`, `styles.css` and `app.js` as needed.
2. Preserve the vanilla, dependency-free architecture.
3. Preserve exact millimetre SVG geometry and the complete-bold-block centring rule.
4. Preserve the no-scroll viewport layout and keyboard accessibility.
5. Ask for the three missing header URLs before wiring those links; do not invent them.
6. After changes, verify unique HTML IDs, linked assets, relevant geometry invariants and supported control ranges.
