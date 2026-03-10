# Drawing App Project Context

Last updated: March 10, 2026
Project root: `c:\Users\paulg\OneDrive - Department for Education\VSCode programming\drawing_app`

## Purpose
Build a browser-based HTML/CSS/JS drawing app for stylus use on iPad and Android, with a visible custom cursor that tracks stylus position during hover (where supported) and drawing.

## Current Status
Working single-page app with stylus-focused drawing controls and right-side tool column.

## Files
- `index.html`: App structure, canvas, cursor image, control buttons.
- `styles.css`: Layout, responsive styling, control panel, color swatches, cursor size/position.
- `script.js`: Pointer event handling, drawing/eraser logic, color selection, save PNG, fullscreen toggle.
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
- Clear button to wipe canvas.
- Save Image button to download a PNG (white background + timestamp filename).
- Full Screen button toggles fullscreen / exit fullscreen (with browser compatibility fallback).

## UX Notes
- On devices without stylus hover support, cursor updates while drawing/touch contact rather than true hover.
- Finger input is intentionally ignored for drawing to keep stylus behavior clean.

## Key Technical Notes
- `touch-action: none` is set on canvas to reduce touch/gesture interference.
- Drawing width uses pressure where available.
- Canvas resize preserves existing drawing content.
- Color selection automatically returns tool mode to draw.

## Known Limitations / Future Enhancements
- No undo/redo yet.
- No adjustable pen or eraser size UI yet.
- No multi-page or layer support.
- No persistent local autosave/session restore.

## Resume Checklist (for future sessions)
1. Open this file first: `PROJECT_CONTEXT.md`.
2. Review current UI/logic in `index.html`, `styles.css`, `script.js`.
3. Confirm priorities with user (e.g., undo, size sliders, palm rejection tuning, export formats).
4. Test stylus behavior on target devices (iPad + Android) after any pointer-event changes.

## Suggested Prompt For Next Session
"Load `PROJECT_CONTEXT.md` and continue from there."
