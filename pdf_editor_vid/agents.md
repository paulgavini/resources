# PDF Editor Project Notes (agents.md)

Last updated: 2026-04-01

## Purpose
This file is the session-resume handbook for this project.
Read this first when starting a new session.

It documents:
- What the app does
- How files are organized
- How key features are implemented
- Current UI/control behavior
- Known constraints
- What to update in this file when code changes

## Project Summary
Browser-only PDF annotation app with no backend and no build step.

Core capabilities:
- Open PDF (file picker or drag/drop)
- Create blank multi-page PDF
- Draw freehand annotations (pen input)
- Highlighter tool (semi-transparent stroke mode) with color selection
- Erase, undo, redo, clear page
- Toggle 1 cm grid
- Navigate pages
- Zoom in/out and fit page width
- Full-screen toggle
- Export annotated PDF
- Record visible canvas area to video with optional selected audio input source
  - Recording scope options: full page or visible viewport

## Tech Stack and Dependencies
- HTML/CSS/JavaScript only
- `vendor/pdf.min.js` + `vendor/pdf.worker.min.js` for viewing/rendering PDFs (pdf.js)
- `vendor/pdf-lib.min.js` for writing/exporting annotated PDFs

No npm, bundler, or framework setup required.

## Versioned Assets (Cache Busting)
- `index.html` currently loads:
  - `styles.css?v=16`
  - `script.js?v=17`
- If a style or script change seems not to apply in browser, bump the corresponding query-string version and hard refresh.

## File Map
- `index.html`
  - App layout and all controls
  - Empty-state home screen now includes a feature list summary and homepage link
  - Three stacked canvases inside `.canvas-stage`:
    - `#pdfCanvas` (base PDF render)
    - `#gridCanvas` (grid overlay)
    - `#drawCanvas` (annotation overlay)
  - Pen cursor image: `#penCursor` from `cursor-arrow-lime.svg`
- `styles.css`
  - Layout, panel styling, control styles, responsive behavior
  - Includes `.icon-button`, `.tool-select`, and `.empty-features` styles
- `script.js`
  - Entire app logic (state, rendering, input handling, export, recording)
- `README.md`
  - Human-facing project notes/run instructions
- `page.pdf`
  - Sample PDF
- `vendor/`
  - Third-party minified libraries (do not edit)

## Runtime Architecture

### State
Single central `state` object in `script.js` stores:
- PDF document/bytes/page info
- per-page annotations (`Map`)
- draw/erase mode and brush settings
- zoom/grid/full interaction flags
- touch/pen gesture state
- recording sub-state (`state.recording`)

### Rendering Flow
1. PDF load sets `state.pdfDoc`.
2. `renderCurrentPage()` gets current page from pdf.js.
3. It computes fit scale, applies zoom, sizes canvases, renders PDF to `pdfCanvas`.
4. Grid and annotations are redrawn on top (`gridCanvas`, `drawCanvas`).

### Annotation Model
- Strokes are stored normalized (0..1 coordinates) per page.
- This keeps annotation geometry consistent across zoom/resizes.
- Erase strokes use `destination-out`.

### Export Flow
- For each page, recreate overlay on offscreen canvas.
- Optionally include grid if enabled.
- Convert overlay to PNG.
- Embed image into original PDF page via pdf-lib.
- Save timestamped output PDF.

## Input Model
- Drawing starts only for pen pointer (`pointerType === "pen"`).
- Touch input is used for pan/pinch zoom gestures.
- iOS WebKit strict touch suppression is implemented to avoid pen/touch conflicts.
- Keyboard shortcuts:
  - Undo: Ctrl/Cmd+Z
  - Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z

## Recording Feature

### What it Records
- Composed canvas output:
  - PDF layer + grid + drawn annotations + pen cursor sprite
- Scope mode can be selected:
  - Full page (entire rendered PDF canvas)
  - Visible viewport (only the currently visible region in the scrollable viewer)

### How it Works
- A hidden composite canvas is maintained for recording frames.
- `captureStream(RECORDING_FPS)` runs on that canvas (`RECORDING_FPS` is currently `30`).
- `MediaRecorder` records stream to chunks.
- Optional selected audio input track is requested with `getUserMedia` and added to stream.
- On stop, chunks are downloaded as timestamped `.mp4`.
- In visible viewport mode, each frame is cropped to the intersection of viewer viewport and page canvas before encoding.

### Recording Guards and UX
- Recording start is blocked when:
  - no PDF is loaded
  - recording is already active
  - MP4 MediaRecorder MIME support is missing
  - no visible source region is available in visible-scope mode
- Audio source request failure aborts start cleanly and resets recording state.
- Recording control enable/disable logic is centralized in `updateRecordingControls()`.

### Current Recording Format
- `.mp4` output target
- Recording starts only when browser supports MP4 MediaRecorder MIME variants.
- MIME chosen by capability check in this order:
  - `video/mp4;codecs=hvc1.1.6.L93.B0,mp4a.40.2`
  - `video/mp4;codecs=avc1.640028,mp4a.40.2`
  - `video/mp4;codecs=avc1.42E01E,mp4a.40.2`
  - `video/mp4`
- If none are supported, recording is blocked with a status message.

### Audio Source Selection
- Audio dropdown lists `audioinput` devices from `enumerateDevices()`.
- Refresh button can prompt microphone permission and repopulate device list.
- `devicechange` listener updates device list dynamically.

## Highlighter Tool
- Highlighter mode uses the current brush size multiplied by `HIGHLIGHTER_SIZE_MULTIPLIER` (currently `3`).
- Default highlighter stroke width remains effectively 12 px at default brush size.
- Highlighter color options are:
  - yellow
  - orange
  - green
- The highlighter color dropdown is shown only while highlighter mode is active and hidden in other modes.
- Invalid dropdown values are guarded and fall back to yellow.

## Key Defaults and Constants
- Brush slider range: `1..24`, default `4`.
- Zoom range: `0.75..4`.
- Eraser size multiplier: `3`.
- Highlighter size multiplier: `3`.
- Recording FPS: `30`.
- Blank PDF page count prompt bounds: `1..50`.

## Control Panel (Current UI)
Many controls are icon-only to reduce top bar width.

Icon buttons:
- Erase
- Highlighter
- Undo
- Redo
- Refresh audio sources
- Start recording
- Stop recording
- Full screen (toggle icon for enter/exit)
- Previous page
- Next page
- Zoom in/out

Text buttons remain for actions where labels are still useful:
- Open PDF
- New Blank PDF
- Clear
- 1cm Grid
- Fit Width
- Export PDF

Select controls:
- Audio source
- Recording area scope (`Area: Full Page` or `Area: Visible View`)

Status text area exists but starts empty (no default text).

### Toolbar Order (Left to Right, Current)
1. Swatches: blue, green, red, highlighter icon, highlighter color dropdown (only visible in highlighter mode)
2. `Open PDF`, `New Blank PDF`
3. Erase, Undo, Redo, Clear, 1cm Grid, Zoom -, Zoom +
4. Fit Width, Full screen, Export PDF, Previous, Next, page indicator, brush size slider
5. Audio source select, recording scope select, refresh audio, start recording, stop recording
6. Status text (right end)

## Empty-State Home Screen (Current)
- Title: `Drop a PDF, open one, or create a blank PDF`
- Includes feature list covering annotation, navigation, export, and recording capabilities.
- Includes external links:
  - Home page: `https://paulgavini.github.io/resources/`
  - YouTube: `https://www.youtube.com/@paulgavini`
- Vertical placement is intentionally raised by matching empty-state height to viewer area:
  - `.empty-state { min-height: calc(100vh - 76px); height: calc(100vh - 76px); }`

## Key Behavior Decisions
- `Fit Width` computes zoom based on current page and viewport width.
- Full-screen button updates both icon and accessible label/title.
- Recording controls auto-enable/disable based on:
  - PDF loaded
  - browser recording/audio support
  - current recording state
- If PDF is reset while recording, recording stop is triggered.

## Browser/Platform Notes
- App is client-side only; no server required.
- Recording support depends on browser APIs:
  - `MediaRecorder`
  - `HTMLCanvasElement.captureStream`
  - media device permissions for audio input
- MP4 recording is implemented but requires browser MP4 MediaRecorder support.

## Resume Checklist (For Future Sessions)
1. Read this `agents.md`.
2. Open `index.html` and confirm control IDs still match script references.
3. Open `script.js` and confirm:
   - `state` structure
   - render pipeline
   - recording lifecycle functions
4. Open `styles.css` and confirm control sizing/toolbar behavior.
5. Verify cache-busting query strings are in sync (`styles.css?v=...`, `script.js?v=...`).
6. If a UI or control was changed, verify accessibility labels are preserved.

## Quick Smoke Test Checklist
- Open sample PDF and confirm page renders.
- Draw with each pen swatch, then undo/redo.
- Switch to highlighter and verify dropdown appears; test yellow/orange/green strokes.
- Switch away from highlighter and verify dropdown hides.
- Toggle grid, zoom in/out, and Fit Width.
- Navigate pages and verify page indicator updates.
- Export PDF and confirm file downloads.
- Recording:
  - Select audio source and refresh list.
  - Record in `Area: Full Page`, then stop and verify `.mp4` output.
  - Record in `Area: Visible View` while scrolled and verify crop behavior.

## Update Protocol (Always Do This After Changes)
When any meaningful project change is made:
1. Update this file in the same session.
2. Edit these sections as needed:
   - `Project Summary` (if scope changed)
   - `File Map` (if files added/removed)
   - Feature sections (rendering/export/recording/UI)
   - `Known constraints` and `Browser notes`
   - `Changelog` entry at bottom
3. Keep entries factual and implementation-oriented.
4. Do not document temporary experiments unless they shipped.

## Known Constraints / TODO Candidates
- Recording requires MP4 MediaRecorder support in the current browser.
- No built-in tab/system audio capture mode; only selected audio input devices.
- No automated tests; verification is manual.

## Changelog
- 2026-04-01
  - Added fit-width button and zoom behavior.
  - Added in-app recording:
    - canvas composition recording
    - optional selected audio input source
    - refresh audio device list and device-change handling
  - Converted multiple toolbar controls to icon buttons:
    - erase, undo, redo, refresh audio, record start/stop, fullscreen, previous, next
  - Removed default status text from toolbar.
  - Reduced audio dropdown width by about 20 percent.
  - Added recording scope selector with two modes:
    - full page recording
    - visible viewport recording (cropped to currently visible region)
  - Switched recording target container to MP4.
  - Recording scope is inline in the toolbar (same interaction style as audio selection).
  - Added yellow highlighter tool button after red pen swatch.
  - Set highlighter default width to 12px (at default brush slider value).
  - Added highlighter color dropdown (`yellow`, `orange`, `green`) that appears only when highlighter mode is selected.
  - Updated the empty-state home screen message to list all key app features.
  - Added homepage link to the empty-state home screen:
    - `https://paulgavini.github.io/resources/`
  - Added YouTube channel link under the homepage link on the empty-state home screen:
    - `https://www.youtube.com/@paulgavini`
  - Moved the empty-state home message upward by aligning empty-state height with the viewer area.
  - Expanded `agents.md` with finer operational detail:
    - cache-busting versions
    - toolbar order snapshot
    - key constants/defaults
    - empty-state link and layout details
    - quick smoke-test checklist
