# Project Memory

## Project Overview

Lesson Sequence Board is a standalone browser application for arranging a sequence of lessons across configurable weeks and lesson slots. It is designed for simple, private, offline-first planning rather than full school administration.

## Current Architecture

The project consists of two standalone HTML documents. `lesson_sequence_board.html` contains the application, with embedded CSS for responsive, dark-mode, and print layouts and JavaScript for rendering, state changes, browser storage, theme preference, drag-and-drop with explicit before-target zones, formatted Excel export, and JSON save/load. `help.html` is a self-contained guide that follows the saved theme preference.

## Current State

Users can create or reset a board with 1-52 weeks and 1-12 slots per week; add empty slots or whole weeks; edit lesson titles and descriptions; resize each week row by dragging its dotted handle and reset it with a double-click; insert after a lesson, delete, or drag/reorder lessons using a blue left-edge drop zone to place a lesson before another; export the board as PDF through the browser's Save as PDF dialog; export a formatted Excel workbook; and save or load a full-fidelity JSON board file. Changes persist automatically in browser storage and, after the user chooses a JSON file in Chrome or Edge, also auto-save to that file. The header displays Graph Paper-style creator information and an accessible light/dark theme control that remembers the choice locally.

## Important Files

- `lesson_sequence_board.html` - application entry point and the complete UI, styling, self-test route, and client-side logic.
- `help.html` - standalone user guide, linked from the app header and styled to follow the saved theme preference.
- `AGENTS.md` - durable instructions for maintaining project memory.
- `PROJECT_MEMORY.md` - concise persistent record of the project's current state.

## Technical Decisions

- No build system, package manager, framework, or server is present; open the HTML file in a modern browser to run it.
- Board state has the shape `{ lessonsPerWeek, weeks, rowHeights }`; each slot is either `{ type: "empty" }` or a lesson with a generated `id`, `title`, and `description`. `rowHeights` holds an optional saved height for each week and remains backward-compatible with older saved boards.
- Lesson numbering is calculated from current physical grid order rather than stored as data.
- Browser persistence uses `localStorage` key `lessonSequenceBoard_v1`; the previous `lessonPlanner_v2` key is read for backward compatibility.
- Theme preference uses `localStorage` key `lessonSequenceBoardTheme`; when no preference is saved, the initial theme follows the device colour-scheme preference.
- In Chrome and Edge, an optional File System Access API target is retained in IndexedDB after the first Save action. Local storage remains the primary autosave; file writes are debounced, never prompt during edits, and silently defer when permission is unavailable.
- Excel export creates a native `.xlsx` workbook named `lesson-sequence-board.xlsx` without external libraries. It preserves the board grid with weeks as rows, lesson slots as columns, lesson/empty-cell styling, wrapped lesson text, frozen headers, and landscape worksheet settings.
- Save files use a versioned `lesson-sequence-board` JSON envelope and retain state exactly, including lesson IDs and empty slots.
- PDF export uses the browser's Save as PDF dialog, landscape pages, fixed margins, exact colour printing, static lesson text, and print-only grid overrides. The overrides neutralize responsive minimum widths and retain blank week rows so headers and lesson cells remain aligned in the PDF.

## Dependencies and External Services

None. The app uses standard browser APIs, including DOM APIs, localStorage, FileReader, Blob, native drag-and-drop, and browser PDF printing.

## Development and Deployment

No build or deployment process is defined. Open `lesson_sequence_board.html` directly in a modern browser. Append `?test` to the URL to run the built-in browser self-tests for Excel workbook construction, board validation, and JSON save-file round-tripping.

## Constraints and Conventions

- Preserve the single-file, dependency-free implementation unless a deliberate architecture change is requested.
- The board is verified to work offline: it has no remote URLs, external assets, or network API calls.
- Preserve the versioned JSON save-file format and Excel grid layout when changing the board data model.
- Preserve the current hierarchy: 14px bold lesson titles, 12px lesson descriptions, 14px board toolbar controls, and 12px creator/theme header controls.
- Update this memory after material project changes, per `AGENTS.md`.

## Known Issues

- The built-in self-tests cover board validation, JSON save-file round-tripping, and Excel workbook construction; no full browser interaction test suite is present.

## Active TODOs

No explicit TODOs are recorded in the repository.

## Recent Significant Changes

- Renamed the product and entry point from Lesson Planner to Lesson Sequence Board.
- Added print/PDF output, JSON backup/restore, accessible lesson movement controls, responsive editing improvements, character-encoding fixes, and built-in self-tests.
- Replaced lesson-shift arrows and in-card + Before controls with blue drag-before target zones.
- Replaced the Print / PDF control with Export PDF and improved PDF layout for landscape output, reliable long-text rendering, aligned headers, and visible blank week rows.
- Replaced CSV exchange and JSON Backup/Restore labels with formatted Excel export and simple Save/Load actions. The Excel export now produces a native `.xlsx` file rather than legacy SpreadsheetML XML.
- Removed textarea resizing and added per-week row resizing with double-click reset to the generated default height.
- Replaced coloured Unicode button symbols with embedded monochrome SVG outline icons, so the interface stays offline and has a consistent IDE-style appearance.
- Repaired a JavaScript syntax error in the row-height validation introduced with row resizing; the application now loads again.
- The create action is black before a board exists and changes to a red Reset Board warning after creation; reset still requires confirmation.
- Added optional Chrome/Edge JSON file auto-save after an explicit initial Save file selection, while retaining local browser autosave and a JSON-download fallback for unsupported browsers.
- Added Graph Paper-style creator information, a locally persisted light/dark theme toggle, and the current board typography hierarchy.
- Added a standalone in-project Help page covering board setup, editing, organisation, saving, exports, and offline use.
