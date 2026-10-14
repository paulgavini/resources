# Project Memory

## Project Overview

Concept Mapper is a browser-based concept and mind map editor. Maps begin with a central idea and grow through connected concepts. The initial layout is designed to reproduce the branching, curved-line look of the supplied Science and Human Endeavour reference image.

## Current Architecture

- `index.html` contains the editor shell, toolbar, canvas, edit dialog, and creator attribution.
- `help.html` contains the in-app user guide, linked from the editor header.
- `styles.css` contains the responsive interface and SVG map styling.
- `app.js` manages the map tree, SVG layout/rendering, editing, browser storage, file import/export, and keyboard shortcuts.
- The map is laid out automatically as a tree. Its remembered layout setting can balance first-level branches on both sides of the central idea or place all branches to its right.

## Current State

- The app opens with an empty map containing a central `Central idea` node. The supplied Science and Human Endeavour map is not preloaded.
- `newtons-laws-example.json` is a downloadable sample map linked from the Help page. It demonstrates three-level concepts, parent-child connection labels, and rich notes; use Load to open it.
- The editor has switchable Map and Outline views backed by the same concept tree and selection. Outline supports nested indentation, branch collapse/expand, double-click editing, arrow-key navigation, and dragging topics by their bullet handle to reorder or nest them. Four Outline-only arrow buttons appear immediately to the right of Delete: up/down reorder among siblings, left decreases indent by promoting the concept to follow its parent, and right increases indent by nesting it under its previous sibling. Each move carries the whole branch; unavailable moves are disabled. The buttons are about 1.25 cm wide and retain the standard 32 px icon-button height. Drag and drop remains available.
- Each concept has a separate optional Notes field alongside its short heading. Notes are edited in the shared concept dialog, shown beneath the heading in Outline, marked before the concept heading on the map with a note icon and hover text, and included after the corresponding heading in Word export. Rich notes support bold, italic, bulleted and numbered lists, superscript, subscript, right-arrow and equilibrium-arrow symbol insertion, and a script-only reset to normal text, following Freeplane's separate note content and text formatting controls.
- Each non-root concept can have an optional short `relationLabel` describing how it connects to its parent. The label is shown on the map connector, above the topic in Outline, and as italic text before the matching Word heading. Clicking or keyboard activating a map connector opens a focused label dialog; the label also remains available in the full concept editor.
- Users can rename concepts, add children and siblings, delete non-central concepts, undo/redo edits, pan/zoom, and fit the map to the canvas.
- Maps recover from browser local storage; users can also link a `.json` file with Save As or Load. In Edge and Chrome the linked file autosaves after edits, its handle is remembered in IndexedDB, save status is shown, and outside file changes stop editing until Reload. New and Load confirm before discarding unsaved work. Browsers without file-system access can still download and import JSON.
- The Export Word action creates a local `.docx` package with 1.27 cm (720 twips) top, bottom, left, and right margins. The central concept references Word Heading 1, children use Heading 2, and deeper concepts follow their map depth through Heading 9. Its valid Heading 1–9 definitions use the Word theme font and standard heading sizes, with the correct outline levels. The settings declare modern compatibility mode.
- Each nonempty note is exported as an indented Normal paragraph directly after its concept heading.
- The initial map fit and node typography have been reduced so the central topic uses less of the canvas. Child label spacing leaves room for the selected-node add control.
- The central topic uses a compact 220-by-54 SVG box. Curved connectors use a fixed 145-unit horizontal clearance at every depth, measured from the parent edge to the child edge, so longer labels do not change the line gap.
- Descendant connectors resolve their parent through the parent layout record's `node.id`; this supports third-level and deeper concepts without aborting SVG rendering.
- Editing supports toolbar controls, double-click, F2, Tab to add a child, Enter to add a sibling (or first child from the central idea), Delete to remove a selected non-central concept, and Ctrl/Cmd+Z and Ctrl/Cmd+Y for undo/redo.
- Further features are expected; the current interaction and file format are an initial foundation.

## Important Files

- `index.html` - app entry point and editor markup.
- `help.html` - user guide for editing concepts, notes, file management, and exports.
- `to_do.md` - research-based prioritized feature roadmap referencing Mindomo and Freeplane.
- `styles.css` - theme, responsive layout, and map visual rules.
- `app.js` - app behavior and map serialization.
- `PROJECT_MEMORY.md` - current project reference and decisions.
- `newtons-laws-example.json` - sample map download.

## Technical Decisions

- Keep the app in plain HTML, JavaScript, and CSS, with no build system or framework.
- Render the map with SVG to preserve curved connectors and scalable image export.
- Store maps as a tree: `{ format, version, title, root }`, with each concept represented by `{ id, text, notes, relationLabel, children }`. `notes` and `relationLabel` are optional when reading older version 1 files. Notes are stored as sanitized, limited HTML; plain-text notes from earlier saves remain supported.
- Keep the central idea as the required root node; it cannot be deleted or added as a sibling.
- Keep local storage as a browser recovery copy, while treating a linked JSON file as the portable source of truth. Persist supported file handles in IndexedDB and check the on-disk file before each autosave to prevent overwriting external changes.
- Draw visual inspiration from Mindomo's central-topic workflow, contextual topic insertion, and Tab/Enter shortcuts. Keep the implementation original and aligned with the repository theme.

## Dependencies and External Services

- No JavaScript libraries or backend services.
- DM Sans and Manrope are requested from Google Fonts when available, with system font fallbacks.
- Uses standard browser APIs: SVG, localStorage, FileReader, Blob, URL, and the HTML dialog element.

## Development and Deployment

- Open `index.html` in a modern browser. No build or deployment process has been established.
- The app uses browser features best supported in current Chrome, Edge, Firefox, and Safari releases.

## Constraints and Conventions

- Make all project changes within `resources/concept_mapper/`.
- Follow the repository visual guidance in `theme.md`: calm light surfaces, botanical green accents, responsive layout, visible keyboard focus, and compact creator attribution.
- Keep the supplied map image as a visual reference; the app starts blank unless the user later requests starter content.
- Keep map files versioned and validate imported JSON before loading it.

## Known Issues

- Maps use automatic tree layout; freeform node dragging and relationship lines between separate branches are not implemented.
- The current Edge preview at `127.0.0.1:3000/resources/concept_mapper/` contains a local preview map saved in browser storage. The default app map remains blank; browser data has not been cleared.

## Active TODOs

- See `to_do.md` for the research-based roadmap. The highest-priority gap is labeled connections between concepts outside the parent/child tree.

## Recent Significant Changes

- Added optional rich concept notes inspired by Freeplane's separate note content. The editor uses a compact heading field and note formatting toolbar for bold, italic, bulleted and numbered lists, superscript, subscript, right-arrow and equilibrium-arrow symbol insertion, and a normal-script reset. Notes remain attached in either view, appear in Outline, are indicated on Map nodes, and export beneath their matching Word headings.
- Updated map file management with planner-style Save As and Load file links, automatic saves, save-state indicator, IndexedDB handle restoration, external-change detection, Reload, and unsaved-change confirmation for New and Load. JSON download/import remain available when the browser lacks file-system access.
- Added a Help link and standalone guide explaining concept editing, Outline drag and drop, notes formatting, linked-file autosave and reload, browser fallback, and exports.
- Used distinct Unicode superscript and subscript numeral glyphs in the notes toolbar.
- Added a prioritized feature roadmap based on Mindomo and Freeplane documentation, with cross-branch relationships as a core mapping gap and backend-dependent collaboration explicitly deferred.
- Added optional labels to parent-child connectors. Labels can be edited in the full concept editor or a separate dialog opened by clicking or keyboard activating a map connector, displayed on the map and in Outline, saved in JSON, and included before the corresponding Word heading. Cross-branch connections remain on the roadmap.
- Replaced the empty entry file with the first blank-map editor, including tree editing, history, zoom/pan, local recovery, JSON import/export, and SVG export.
- Added Mindomo-inspired central-topic and topic-insertion interactions, while retaining the repository's theme and original styling.
- Used Edge to inspect concept insertion, then reduced the default map scale and text sizes, moved add controls farther from concept labels, and added wrapping for long unbroken words.
- Fixed the descendant connector parent lookup after reproducing a third-level insertion failure in Edge. Verified that the three-node map renders all 3 nodes and both connecting paths.
- Added a collapsible outline view and a Map/Outline switch. Verified in Edge that the same selected concept is retained when switching between views.
- Added Mindomo-inspired outline drag and drop: a topic can be dropped before or after a sibling to reorder it, or onto another topic to nest the full branch. The central idea stays fixed and descendant cycles are rejected. Verified both operations in Edge and undid the preview changes afterward.
- Added four Outline-only arrow buttons immediately after Delete for moving the selected concept up or down among siblings and decreasing or increasing its indent. The buttons use the shared tree-move and history behavior, carry entire branches, disable moves that are not available, and are about 1.25 cm wide while retaining the standard 32 px height. Drag and drop remains available.
- Added Word `.docx` export with Heading 1–9 mapped from concept depth. Heading styles use the Word theme font and standard heading sizes. The exporter packages the document locally in the browser without an external library.
- Added modern compatibility settings to the Word package and restored complete Heading 1–9 definitions after confirming Word treated headings as Body Text when the styles part was omitted.
- Reduced central-topic whitespace and changed branch positioning to preserve the same parent-edge connector gap across all levels. Verified the rendered SVG in Edge; all 10 current connector paths have a 145-unit horizontal gap and no console errors.
