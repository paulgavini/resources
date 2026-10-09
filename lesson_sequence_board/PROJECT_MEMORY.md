# Project Memory

## Project Overview

Lesson Sequence Board is a standalone, offline-capable browser app for arranging lessons in a configurable week-by-lesson grid.

## Current Architecture

- `lesson_sequence_board.html` is the complete application: markup, responsive CSS, board rendering, save/load, validation, undo/redo, and Excel generation.
- `help.html` is a standalone user guide.
- There is no build system, framework, package manager, or server.

## Current State

Users can create boards with 1–52 weeks and 1–12 lessons per week, add weeks and lessons, edit lesson title and description in a dialog, reorder cards by dragging, delete or insert lessons, and undo/redo up to 100 changes per session. Cards show the lesson number, bold title beneath it, and the description. The + and − actions sit in the top-right of each lesson cell; empty cells have an Add Lesson control.

Week rows automatically fit their tallest cell, with an 80 px minimum and about one line of space after the content. Descriptions are not truncated. Dragging a week divider saves a manual row height; double-clicking restores automatic sizing. Lesson-slot headings remain sticky while scrolling.

On supported Chrome and Edge setups, a linked JSON file is the source of truth. The app restores its local file handle at startup, auto-saves edits after a short debounce, compares the current file against its last loaded version before writing, and locks editing when permission is lost or an external change is detected until Reload. Each computer needs its own browser link to the synced JSON file; users should wait for sync before resuming edits. Browsers without file picker support can import JSON and download copies, but cannot auto-save to a linked file. Excel export creates a separate timestamped `.xlsx` workbook.

The app uses a planner-inspired, light-only visual style. The Help link opens in a new tab; Help includes instructions to save the Year 10 motion demo JSON, a reusable AI prompt with a copy button, and setup guidance.

## Important Files

- `lesson_sequence_board.html` - application entry point and all application code.
- `help.html` - user guide and demo JSON link.
- `year_10_science_motion_6_weeks.json` - complete Year 10 Science motion demo: 24 lessons, 6 weeks, 4 slots per week, automatic row heights.
- `AGENTS.md` - durable project-maintenance instructions.
- `PROJECT_MEMORY.md` - current project reference.

## Technical Decisions

- Board state has the shape `{ lessonsPerWeek, weeks, rowHeights, details }`. `details` stores board-level notes from the Board setup panel. Each cell is either `{ type: "empty" }` or a lesson with a unique `id`, `title`, and `description`. Lesson numbers are derived from current grid order.
- JSON saves use the `lesson-sequence-board` format, version 1, and preserve lesson IDs, empty cells, and optional row heights. `_fileMeta` tracks save time and revision. Planner JSON files use a different schema and are not interchangeable.
- Linked file handles are stored in IndexedDB, separately per browser profile/computer. Before saving, the app compares the file text with the text last loaded or saved; mismatch blocks the write and requires Reload.
- Legacy browser-stored board data is read only for migration and cleared after JSON save/load. The app does not write current board contents to localStorage.
- Automatic row sizing uses content-based CSS grid tracks with an 80 px minimum. Saved row heights are limited to 80–720 px; a `null` row height means automatic sizing.
- Excel export builds a native `.xlsx` workbook without external libraries. It keeps weeks as rows and lesson slots as columns, with a frozen header and wrapped cell text.
- The app declares light color scheme and ignores retired saved theme preferences.

## Dependencies and External Services

None. The app uses browser APIs including DOM, IndexedDB, localStorage for legacy migration only, File System Access, FileReader, Blob, and native drag-and-drop.

## Development and Deployment

Open `lesson_sequence_board.html` in a modern browser. Add `?test` to run the built-in checks for board validation, JSON round-tripping, and Excel workbook creation. There is no build or deployment process defined.

## Constraints and Conventions

- Keep the app standalone, dependency-free, and offline-capable.
- Keep the planner folder read-only when using it as a design reference; make project changes only in `lesson_sequence_board`.
- Preserve JSON compatibility and the existing Excel grid layout when changing board data.
- Preserve responsive layout, visible focus states, sticky lesson headings, session undo/redo, manual row resizing, and file conflict protection.
- Update this memory after material project changes, following `AGENTS.md`.

## Known Issues

The built-in checks cover data validation, JSON save-file round-tripping, and Excel workbook creation; there is no full browser interaction test suite.

## Active TODOs

No explicit TODOs are recorded.

## Recent Significant Changes

- Reorganized the app header and board setup panel to follow the Weekly Planner layout.
- Added the loadable 24-lesson Year 10 Science motion demo and a Save link as guide in Help.
- Added a Copy AI Prompt button beside the demo JSON link in Help.
- Updated lesson cards with stacked bold titles and top-right +/− actions.
- Added a board-level Details field beside its text area in setup, with debounced auto-save while typing and blank defaults for older JSON boards.
- Switched default week rows to content-fit sizing, full descriptions, and an 80 px minimum while retaining manual resize.
- Aligned JSON file handling with the planner’s sync-aware workflow, including conflict detection, Reload recovery, and per-computer file links.
