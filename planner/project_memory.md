# Project memory

## Purpose

Replace a handwritten teaching planner with a simple electronic weekly planner built in vanilla HTML, CSS, and JavaScript.

## Confirmed product decisions

- The planner has four selectable tabs: Term 1 through Term 4.
- Each term has its own starting Monday, subject list, recurring schedule, and week count.
- Each term starts with six weeks. The `+` control adds a week; `−` removes the last week. Keep at least one week.
- The grid has weeks as rows and Monday–Friday as columns, with the week number in a left gutter.
- A subject is created from its displayed name and the weekdays it is taught. Its lesson occurrences appear on those weekdays across the term. New weeks receive the term's recurring lessons.
- A single lesson occurrence can be dragged to another day. Other occurrences remain in place.
- Dragging a scheduled occurrence within the same weekday changes that weekday's sequence across every week in the selected term.
- Changing a subject's taught days updates the term schedule. Existing lesson occurrences on removed weekdays remain as one-off exceptions.
- Selecting a lesson opens editable notes for that occurrence. Notes are stored per occurrence, so weeks can have different notes.
- Each day cell has a simple `+` control for independent day notes, separate from lesson notes. Notes belong to the date and term, can be dragged to another day or to a position between that day's lessons, shift with that term's start date, and are removed with their week. Multiple notes may share a day and moving one never overwrites another.
- The planner grid uses 95% of the page width. Long notes wrap within their day cells so rows and the HTML page grow vertically; do not put the grid in a nested scroll area.
- Past day cells use a different background colour, based on the browser's local date.
- Treat the linked JSON file as the planner's source of truth so the same planner can be used across computers. Do not autosave planner content to browser storage. Browser IndexedDB may remember a local file handle; do not write cached planner data to a linked file on startup.
- Provide `Save As` and `Load` using JSON files. The first suggested filename uses the exact prefix `Weekly_Plannner` followed by the local date and time.
- After choosing or loading a file in a supported secure Edge/Chrome context, keep its handle in IndexedDB and save changes to that file. Read the linked file before enabling editing on startup. Record an update timestamp and compare the on-disk contents with the last loaded version before saving; if they differ, pause editing and offer Reload. If file-system access is unavailable, allow JSON download and file import and explain that ongoing file autosave is unavailable in that context.
- When switching computers, tell the user to wait for cloud-folder sync and refresh the page before editing. Reload the linked file after refresh; do not push browser-cached planner content into it.
- Show a green status dot when the linked JSON file has saved successfully; omit the `.json` extension from displayed file names while retaining it on disk.
- `New` asks before discarding unsaved changes, queues pending linked-file writes when possible, then disconnects the old file before starting a blank four-term, six-week planner. The user can create a separate file with `Save As`.
- Undo and Redo cover planner edits, up to 100 recent states, and are available beside the week controls. Ctrl/Cmd+Z undoes; Ctrl+Y or Cmd+Shift+Z redoes. Switching term tabs is not an undoable edit. Loading a file or starting New clears history.
- From Manage subjects, users can copy recurring subjects and weekday order from another term. Copying replaces the destination's subjects and lesson occurrences (including one-off moves and lesson notes), while retaining its start date, week count, and day notes. New lesson occurrences use the destination term's dates and week count. Confirm before replacing.

## Current implementation

- `index.html`, `styles.css`, and `app.js` make up the app.
- `project_memory.md` records the product decisions for future work.
- Existing data from older versions may be read once from `weekly-planner-data-v1` for migration; new planner changes are no longer written there. A linked JSON file is remembered in IndexedDB when the browser allows it.
- Planner JSON stores the versioned state shape (`version`, `activeTerm`, and four `terms`) plus `_fileMeta` with its most recent save timestamp and revision identifier.
- `Export Excel` creates a downloadable `.xlsx` workbook without changing the planner JSON. It has one worksheet per term and rows for lessons and day notes, including date, day, visible order, notes, scheduled date, and whether a lesson was moved. The dependency-free browser writer packages the workbook locally.
- Day notes have a completion checkbox on the right side of the card. The checked state is saved in JSON and displayed as a tick. Older planner files default day notes to incomplete. Completion state is not included in Excel export.
- Per-weekday lesson sequence is stored separately for each term and weekday.
- Lesson notes are stored on each lesson occurrence.
- Day notes are stored as individual dated records in each term, with a per-day lesson position for interleaving notes and lessons.
- A loadable demonstration dataset is available as `Weekly_Planner_Demo_2026.json`. It covers the supplied 2026 dates with week counts 11, 10, 10, and 9, includes 3–5 random day notes per week at varied positions among lessons, and has illustrative lesson notes on every scheduled occurrence. Term 1's grid starts Monday 26 January to include its official Tuesday 27 January start; 9 Tutorial is scheduled Friday based on the supplied planner image.
- `help.html` is the plain-language user guide and is linked from the planner header. The demo JSON also contains a `_help` file reference. The guide explains file saving, cross-computer sync, weekly schedules, notes, and includes an as-is/no-warranty disclaimer with a caveat for rights that cannot legally be excluded.
- The help guide describes Undo/Redo shortcuts and copying schedules between terms.
- The planner header shows `By Paul Gavini · YouTube · Website · Help` to the right of the title at the existing 11px text size. Keep the separate Help button removed; the Help link in this attribution opens `help.html`. On narrow screens the attribution wraps below the title to prevent crowding.
- The start-date control accepts Mondays only. Changing a term's Monday shifts that term's existing scheduled and moved lesson dates by the same number of days.
- Deleting a subject removes its lesson occurrences from the selected term. Removing a week deletes occurrences scheduled in that week; occurrences moved into the removed week from another week return to their scheduled date.

## Session checkpoint — 2026-10-06

- Completed: Undo/Redo (up to 100 edits), copy schedules between terms, a dependency-free four-sheet `.xlsx` export, and day-note-only completion checkboxes with a visible tick.
- The day-note completion state is saved in JSON. Per the user's direction, it is not included in the Excel export; lesson cards do not have completion checkboxes.
- Updated `help.html` with instructions for Excel export, day-note completion, and the 100-step Undo/Redo limit. The user is finished for today; continue from the remaining to-do list below.

## Product constraints

- Keep the app dependency-free and browser-based.
- Keep term schedules independent.
- Allow multiple lesson entries in a day cell.
- Dragging is limited to dates shown in the selected term's grid.
- Keep long notes readable by wrapping them within the page-width grid and allowing the document to grow vertically.

## To do list

1. Open the generated `.xlsx` in Excel and verify it contains four usable term sheets with the expected lessons, notes, and order.
2. Add a simple backup and restore workflow, and make unsaved changes and save failures easy to spot in every browser mode.
3. Document and manually check cross-computer saving cases: cloud sync, lost permission, stale pages, and overlapping edits.
4. Add touch-friendly lesson and note movement, plus keyboard controls for reordering and moving them.
5. Add a print-friendly term view or PDF export.
