# Outline Noter — Project Guide and Log

This file orients future sessions and tracks decisions, changes, and next steps. Keep it at repo root so Codex auto-loads it.

- Last updated: 2025-11-09
- How to run: open `index.html` in a modern browser (no server required).

## Overview
A single‑page outliner with a tree on the left and a rich text editor on the right (contenteditable). Stores notes in `localStorage`; supports search, drag & drop reordering, keyboard shortcuts, JSON import/export, and static HTML export. Images can be pasted/dropped and are embedded as base64 data URLs. A simple offline LaTeX subset is supported via custom rendering.

## Files
- `index.html`: App shell and controls.
- `styles.css`: Layout, theme, editor/toolbar, drag indicators.
- `app.js`: Entire app logic: tree CRUD, DnD, search, editor commands, image handling, LaTeX subset renderer, persistence, exports, shortcuts, image-resizer fallback.
- `formula-reference.html`: Reference/playground for the LaTeX subset renderer used by the app.

## Data Model
- Node: `{ id, title, content, children: [], collapsed }`
- Root state: `db = { root: Node }`
- Selection: `selection = Node.id`
- Persistence key: `localStorage['treepad-web-db-v1'] = { db, selection }`

## Shortcuts
- Enter: new sibling; Ctrl+Enter: new child
- F2: rename; Delete: delete
- Alt+ArrowUp/Down: move up/down
- Tab: indent; Shift+Tab: outdent

## Current State (Review)
- Works offline and functionally complete for basic outlining.
- JSON export/import and static HTML export function.
- Image paste/drag-drop embeds images inline as base64 `data:` URLs.
- Custom LaTeX subset renders fractions, square roots, super/subscripts, arrows, and Greek letters.

## Issues Observed
- Encoding/glyph corruption in multiple places (likely mojibake):
  - Sidebar move/indent/outdent buttons and tree toggles show garbled symbols.
  - Placeholder text in editor shows a replacement character.
  - LaTeX subset renderer’s Greek/arrows mapping outputs corrupted glyphs; the reference page reflects this too.
- Persistence limits: large images bloat `localStorage` (size/quota, performance, backup pain).
- Security: node content is stored and rendered as raw HTML (acceptable offline, but worth noting).
- Accessibility: tree and toolbar could use more ARIA roles/labels for screen readers.

## Recommended Fixes (Minimal)
1. Replace all UI glyphs with safe HTML entities or plain text labels.
   - Example: use `&blacktriangleright;`/`&blacktriangledown;` or simple `+`/`-` for toggles; use `↑`, `↓`, `→`, `←` via entities.
2. In the LaTeX renderer, map Greek letters and arrows to HTML entities instead of raw codepoints to avoid platform/font issues.
3. Normalize the editor placeholder text to ASCII or proper entity.

## Recommended Enhancements (Next Iteration)
- Store images/blobs in IndexedDB instead of base64 in HTML for scale and performance.
- Add bundle export/import (zip with manifest + assets) for easy backup/restore.
- Optional: migrate contenteditable to a richer editor only if needed; otherwise keep lean.
- Add ARIA and keyboard affordances to the tree and toolbar.

## Session Log
- 2025-11-09:
  - Reviewed `index.html`, `styles.css`, `app.js`, and `formula-reference.html`.
  - Identified pervasive encoding issues affecting UI labels, toggle icons, and LaTeX render output.
  - Confirmed features: tree CRUD, DnD, search, shortcuts, JSON/HTML export, image paste/drop with base64, image resizer overlay, LaTeX subset.
  - Proposed: fix glyphs via entities; refactor LaTeX mapping to entities; consider IndexedDB for image assets; add bundle export.
  - Created this `AGENTS.md` to be auto-loaded next session.
  - Implemented IndexedDB (IDB) persistence with two stores: `meta` (state) and `assets` (image blobs). Kept JSON import/export working offline. HTML export unchanged.
  - Verified behavior: exporting a new note opened on Android and images displayed because they were embedded as `data:` URLs (likely pasted HTML with data URLs). This is expected and requires no change.
  - Implemented glyph fixes without changing HTML/CSS files directly (to avoid mojibake editing):
    - Tree toggle icons now render as ASCII `[+]`/`[-]` at runtime.
    - Sidebar move/indent/outdent buttons and unordered list button labels normalized via JS (`Up`, `Down`, `Indent`, `Outdent`, `* List`).
    - Editor placeholder text overridden via injected style to `Start typing your note...`.

## Image Handling Behavior (Current)
- HTML paste with embedded data URLs: if clipboard provides HTML containing `<img src="data:image/...">`, the editor keeps those as-is. Exported HTML includes them and works standalone on mobile/other devices.
- File paste/drag-drop images: when the clipboard/files expose real image files, images are stored in IDB (`assets`) and inserted as `<img data-asset-id="...">` for persistence. The saved HTML keeps only `data-asset-id` (no `src`). Current HTML export does not inline these IDB assets; JSON export includes them under `assetsInline`.
- Per user request, do not modify the HTML exporter at this time.

## Maintenance Notes
- Continue updating this log after every change: what changed, why, and any user decisions (e.g., “keep exporter unchanged”).

## Quick TODOs
- [ ] Replace garbled glyphs in `index.html`, `styles.css`, `app.js` with entities.
- [ ] Update LaTeX renderer mapping to entities (Greek, arrows); fix `formula-reference.html` accordingly.
- [ ] Consider switching image storage to IndexedDB and updating export/import accordingly.
- [ ] Add minimal ARIA to tree (`role="tree"`, `treeitem`), toolbar button labels.
 
## 2025-11-09 (Glyph fixes applied)
- Runtime UI normalization added in `app.js` for toggles and labels (ASCII-safe).
- CSS placeholder overridden to ASCII via rule appended to `styles.css`.
- LaTeX rendering: introduced safe wrappers in `app.js` and `formula-reference.html` that map Greek letters and arrows to HTML entities and use `&#8730;` for sqrt; render pipeline now calls these safe helpers.

## 2025-11-09 (Title UI move)
- Moved the node Title field from the editor toolbar to the left sidebar under the search box for quicker access:
  - `index.html`: added `<div class="title-box">` under `#search`, removed `.title-edit` span from the toolbar.
  - `styles.css`: added `.title-box` styles (flex row, label, input sizing).
  - JS already binds `#titleInput`, so no logic changes were required.

## 2025-11-09 (Rename button removed)
- Removed the `Rename` button from the sidebar since the Title field now handles renaming inline.
- Updated `app.js` bindings to guard against missing `#renameNode` and changed the `F2` shortcut to focus/select the Title input instead of prompting.

## 2025-11-09 (Usage meter + labels)
- Added a real-time storage usage meter in the footer:
  - `index.html`: added `<span id="usageMeter" class="usage">` next to status.
  - `app.js`: implemented `refreshUsage()` using `navigator.storage.estimate()`; invoked on init, after saves/imports/exports, and via a 60s interval.
  - `styles.css`: added `.usage` style.
- Renamed header buttons: Import → Load, Export → Save (JSON buttons only).

## 2025-11-09 (User validation)
- User confirmed the app is working as desired with the following behaviors:
  - New notes exported to HTML opened on Android and displayed images (when pasted HTML carries data URLs). No change requested to HTML export.
  - Glyph fixes render correctly across UI and formula reference.
  - Title field in the sidebar replaces the Rename flow; `F2` now focuses the Title input.
  - Real-time usage meter displays current `usage/quota` as MB/GB and percent.
- Quota check reference:
  - Run in console: `await navigator.storage.estimate()` → shows `{ usage, quota }`.
  - `await navigator.storage.persisted()` indicates if storage is persistent.

## Current Status Snapshot
- Storage: IndexedDB for state + assets (with localStorage fallback); persistent storage requested.
- Import/Export: JSON uses Load/Save labels; JSON bundles inlined assets; HTML export unchanged (copies saved HTML).
- UI: Title input in sidebar; Rename removed; glyphs standardized; usage meter visible.
- Shortcuts: `Enter`/`Ctrl+Enter` add nodes; `F2` focuses Title input; DnD and indent/outdent with Tab.

## Maintenance
- Keep this log updated after every change (summary of what/why and user decisions).

## 2025-11-09 (Usage display format)
- Adjusted usage meter text to show exactly: `X.Y MB of Z.Z GB (P.PP%)` with no leading words. When quota is unavailable, it shows `X.Y MB` (no extra wording).

## 2025-11-09 (Remove selection status)
- Removed the footer status update that previously showed `Selected: <title>` on node selection. The footer now stays reserved for general status (e.g., Loaded/Saved) and the usage meter, since selection is visually obvious in the tree and title field.

## Notes for Future Codex Sessions
- Keep changes surgical; do not introduce unrelated refactors.
- Prefer HTML entities for symbols to avoid encoding issues.
- If adding persistence for binary assets, favor IndexedDB over `localStorage`.
- Before large changes, update this file to capture decisions and rationale.

## 2025-11-09 (Default JSON filename)
- Export JSON now defaults to the root outline title: the filename is derived from `db.root.title`, sanitized for filesystem safety, with a `.json` extension. Fallback remains `outline-noter.json` if the title is empty.

## 2025-11-09 (Default HTML filename)
- Export HTML now also defaults to the root outline title: the filename is derived from `db.root.title`, sanitized, with a `.html` extension. Fallback remains `outline-export.html` if the title is empty.

## 2025-11-10 (HTML export inlines images)
- Per user request, updated the static HTML exporter to embed images.
  - `app.js`: `exportHtml()` is now async and inlines any `img[data-asset-id]` by fetching the corresponding blobs from IndexedDB, converting to base64, and setting `src="data:<mime>;base64,..."` while removing `data-asset-id`.
  - Existing images already stored as `data:` URLs remain unchanged.
  - JSON export/import behavior unchanged; HTML export is still standalone but now includes IDB-backed images.
  - Change is surgical; no UI or styling changes.

## 2025-11-11 (SunEditor + KaTeX)
- Replaced the contenteditable editor with SunEditor and enabled KaTeX.
  - index.html: included `se/suneditor.min.css`, `se/suneditor.min.js`, `se/katex/katex.min.css`, `se/katex/katex.min.js`.
  - styles.css: made SunEditor fill the editor pane and use the app’s default font.
  - app.js: created the SunEditor instance on `#editor` with `katex: window.katex`, wired `onChange` to persistence, preserved the data model.
  - exportHtml(): now inlines KaTeX CSS so math renders offline in exports.
  - Old toolbar left in markup but hidden via CSS to avoid mojibake edits.

## 2025-11-11 (Image restoration in editor)
- Fixed images not displaying in the editor when loading saved notes:
  - Reattached missing `data-asset-id` by scanning saved HTML and annotating corresponding images in the editor when necessary.
  - Resolved images from IDB using SunEditor’s editable root and applied object URLs for preview.

## 2025-11-11 (Toolbar changes)
- Removed Image and Link buttons (insertion disabled). Existing images/links still render.
- Enabled lists and tables; expanded tag/attribute whitelists accordingly.
- Added Highlight, Horizontal Rule, and Print toolbar actions.

## 2025-11-11 (UX/Shortcuts)
- Updated “in-editor” detection to SunEditor’s container so outline shortcuts remain functional.
- Disabled legacy image resizer overlay (SunEditor handles resizing).

## Current Status Snapshot (updated)
- Editor: SunEditor with KaTeX; no link/image insertion.
- Formatting: bold/italic/underline, align, lists, tables, highlight, horizontal rule, print, removeFormat, codeView.
- Images: stored in IDB, previewed via blob URL in editor, inlined in export.
- Export: KaTeX CSS is inlined for offline math rendering.
