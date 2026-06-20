# Rubric GPT Session Notes

## Project Summary
Rubric GPT is a dependency-free vanilla HTML, CSS and JavaScript app for teachers. Teachers enter rubric criteria, A-E or N grades and student names, then copy a structured prompt into ChatGPT to generate report comments.

## Main Files
- `index.html` - App structure, controls, header links and form fields.
- `styles.css` - Excel-like layout, compact responsive styling and rotated criterion headers.
- `app.js` - App state, autosave, rubric editing, JSON import/export and prompt generation.

## Current Features
- Spreadsheet-style student grade table.
- Student names on the left, rubric criteria across the top.
- Add/delete students.
- Add/delete criteria.
- A-E and N grade dropdowns in each student/criterion cell, where N means not attempted.
- Grade dropdowns default to blank and show a pale red background until completed.
- Criterion descriptor editor with A-E and N descriptor text.
- Toggle to include or exclude criterion descriptors from the generated prompt.
- Comment length options: `≤ 50`, `≤ 100`, `≤ 150` and `≤ 200` words.
- Tone options, with `Where are they now and where to next` first.
- Browser autosave using `localStorage`.
- Export/load app data as `.json`.
- Export the current student results table as a `.pdf` for file storage.
- Copy-ready ChatGPT prompt output.
- The prompt output panel expands to fill the remaining page height.
- Prompt output actions include `PDF results` and `Copy prompt`.
- Header links:
  - `By Paul Gavini using CODEX` -> `https://www.youtube.com/@paulgavini`
  - `Home` -> `https://paulgavini.github.io/resources/`
- Current default context values:
  - Subject / year level: `Year X Science`
  - Assessment task: `Practical report`

## Important UI Decisions
- The app should feel compact and spreadsheet-like, similar to Excel.
- Current visual style is minimalist and technical:
  - Full-width layout.
  - White canvas, black text, 1px borders.
  - No gradients or shadows.
  - Tiny 2px radii on controls/panels.
  - Light blue is reserved for emphasis, selected criteria and table header differences.
  - Light green is used for the primary copy action.
  - Light red is used for delete/destructive controls.
- Criterion names are edited horizontally, but display rotated at `-90deg` when not being edited.
- Criterion columns auto-fit across the Student Grades area.
- Extra criteria should remain usable through horizontal scrolling if needed.
- Criterion header height was increased by about 1cm to give rotated text more room.
- Grade dropdowns are centered and set to 90% of their table cell width.
- Incomplete blank grade dropdowns and their table cells use pale red danger styling.
- Student delete buttons use the same light red danger style as the criterion delete button and are shifted left within the student row control cell.
- Header file controls are labelled `Export`, `Load` and `Reset`.
- Use ASCII-only characters in files unless there is a clear reason not to. The `≤` character is intentionally used for comment length labels.

## Prompt Behaviour
- Descriptor mode on:
  - Prompt includes criteria, A-E and N descriptors and each student's selected grades with matching descriptor text.
- Descriptor mode off:
  - Prompt includes only criterion names and selected A-E or N grades.
  - Prompt keeps the instruction: `Use only the criterion names and selected A-E or N grades as evidence. N means not attempted and should affect the estimated overall grade and comment.`
- Prompt asks ChatGPT to:
  - Use Australian spelling.
  - Avoid inventing extra achievements, behaviour, scores or personal details.
  - Treat N as not attempted when estimating the overall grade and writing the comment.
  - Ask the teacher to complete missing grades if any criterion says `[No grade selected]`.
  - Avoid mentioning the grade for each criterion in the comment; use descriptive language reflecting the grade instead.
  - Include strengths and next steps.
  - Return each student's name, an estimated overall grade and their comment.
- Student grade selections show raw grades only, for example `N`, not `N (not attempted)`.
- Blank grade selections show as `[No grade selected]` in the prompt and `Incomplete` in the PDF export.

## Testing Notes
- The app is intended to open directly from `index.html`; no dev server is required.
- Previous checks used:
  - Mocked browser smoke test through the Node REPL MCP.
  - Headless Microsoft Edge screenshots for layout verification.
  - ASCII scan with `Select-String -Pattern '[^\x00-\x7F]'`.
- Temporary screenshot files should be deleted after verification.
