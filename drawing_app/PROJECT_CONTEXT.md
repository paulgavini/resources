# Drawing App Project Context

Last updated: March 11, 2026
Project root: `c:\Users\paulg\OneDrive - Department for Education\VSCode programming\drawing_app_mod`

## Purpose
Build a browser-based HTML/CSS/JS drawing app for stylus use on iPad and Android, with a visible custom cursor that tracks stylus position during hover (where supported) and drawing.

## Current Status
Working single-page app with stylus-focused drawing controls and right-side tool column.

## Files
- `index.html`: App structure, canvas, cursor image, control buttons.
- `styles.css`: Layout, responsive styling, control panel, color swatches, cursor size/position.
- `script.js`: Pointer event handling, drawing/eraser logic, color selection, image paste placement workflow, project save/load, all-pages PDF export, fullscreen toggle.
- `help.html`: Standalone usage and feature guide opened in a separate tab.
- `pen-cursor.svg`: Lime-green arrow cursor graphic.

## Implemented Features
- Stylus-only drawing via Pointer Events (`pointerType === "pen"`).
- Custom cursor image shown at stylus location.
- Cursor color/style: normal arrow, lime green.
- Cursor size increased to ~20% above earlier size (currently `29px` square).
- Writing area layout:
  - Main drawing zone with controls in a right-hand vertical column.
  - No top bar.
  - Main content constrained to `95%` page width.
- Ink colors (small no-text swatches):
  - Default (current dark blue): `#1f3d66`
  - Lime green: `#7cff00`
  - Bright red: `#ff0000`
- Eraser mode using canvas compositing (`destination-out`).
- Undo button under Eraser:
  - Per-page undo history (independent stack per page).
  - History capped at `10` states per page.
- 1cm grid toggle button:
  - Faint grey graph grid shown on canvas background.
  - Grid visibility can be toggled on/off at any time.
- Clear button to wipe canvas.
- Export PDF button to download all pages as a single PDF (offline, local generation).
  - If grid is enabled, PDF export includes the grid.
- Save/Load project workflow:
  - `Save Project` exports complete app state to JSON (pages, undo histories, tool/grid state, current page).
  - `Load Project` restores from that JSON file.
- Clipboard image placement workflow:
  - Paste image from clipboard (`Ctrl+V` / paste action).
  - `Paste` button under `1cm Grid` to trigger clipboard image read without a keyboard (tablet-friendly, browser permission dependent).
  - Drag and corner-resize overlay to position before committing.
  - `Place Image` commits to canvas; `Cancel Image` discards.
- Full Screen button toggles fullscreen / exit fullscreen (with browser compatibility fallback).
- Multi-page workflow:
  - `Prev`, `Next`, `New Page`, `Delete Page` controls in the right-side panel.
  - Page indicator (`Page X of Y`) with button disable states at boundaries.
  - Current page auto-snapshots on page switch and drawing end.
  - Page limit set to `15` pages.
- Help access:
  - `Help` link below `Delete Page`.
  - Opens `help.html` in a new tab to avoid interrupting active drawing work.

## UX Notes
- On devices without stylus hover support, cursor updates while drawing/touch contact rather than true hover.
- Finger input is intentionally ignored for drawing to keep stylus behavior clean.

## Key Technical Notes
- `touch-action: none` is set on canvas to reduce touch/gesture interference.
- Drawing width uses pressure where available.
- Canvas resize preserves existing drawing content.
- Color selection automatically returns tool mode to draw.

## Known Limitations / Future Enhancements
- No adjustable pen or eraser size UI yet.
- No layer support.
- No automatic local autosave/session restore (manual Save/Load project is available).
- PNG single-page export is no longer used; export is now multi-page PDF.
- No redo yet (undo only).

## Resume Checklist (for future sessions)
1. Open this file first: `PROJECT_CONTEXT.md`.
2. Review current UI/logic in `index.html`, `styles.css`, `script.js`.
3. Confirm priorities with user (e.g., undo, size sliders, palm rejection tuning, export formats).
4. Test stylus behavior on target devices (iPad + Android) after any pointer-event changes.

## Suggested Prompt For Next Session
"Load `PROJECT_CONTEXT.md` and continue from there."
