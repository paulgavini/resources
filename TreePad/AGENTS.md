# Outline Noter (TreePad) — Project Guide

This file is the session handoff and maintenance guide for the TreePad project.

- Last updated: 2026-03-28
- Run locally: open `index.html` in a modern browser (no server required)

## Overview
Outline Noter is a single-page outliner with:
- Left pane: hierarchical tree (drag/drop, keyboard navigation, search)
- Right pane: SunEditor rich-text notes with KaTeX math support
- Persistence: IndexedDB primary (`meta`, `assets`) with localStorage fallback
- Import/export: JSON backup (with inlined assets), static HTML export

## Files
- `index.html`: app shell and controls
- `styles.css`: layout/theme, responsive behavior, focus styles
- `app.js`: tree model, rendering, keyboard handling, persistence, import/export, editor wiring
- `formula-reference.html`: separate LaTeX subset reference playground (legacy reference page)
- `se/`: bundled third-party editor and KaTeX assets

## Data Model
- Node shape:
  - `{ id, title, content, children: [], collapsed }`
- Root state:
  - `db = { root: Node }`
- Selection:
  - `selection = Node.id`

## Storage Model
- IndexedDB database: `outline-noter`
- Object stores:
  - `meta` (keyed state blob)
  - `assets` (image blobs for `img[data-asset-id]`)
- Save path:
  - Debounced autosave queue for silent edits (typing)
  - Immediate queued save for explicit actions (tree structure, imports, etc.)
  - localStorage fallback key: `treepad-web-db-v1`

## Security/Sanitization
Content is sanitized before persistence and export:
- Removes risky tags (`script`, `iframe`, `object`, etc.)
- Removes inline event handlers (`on*`)
- Sanitizes unsafe inline CSS patterns
- Validates links and image `src` protocols
- Preserves IDB-backed images by retaining `data-asset-id` and stripping transient blob `src`

## Tree Accessibility + Keyboard
- Tree uses ARIA roles:
  - container: `role="tree"`
  - items: `role="treeitem"`, `aria-level`, `aria-selected`, `aria-expanded`
- Tree keyboard navigation:
  - `ArrowUp` / `ArrowDown`: previous/next visible node
  - `ArrowRight`: expand node or move to first child
  - `ArrowLeft`: collapse node or move to parent
  - `Home` / `End`: first/last visible node
  - `Delete`: delete selected node
  - `F2`: focus title input
  - `Ctrl+Enter`: add child

## App Shortcuts
Global shortcuts (outside editor/search/title/tree):
- `Enter`: add sibling
- `Ctrl+Enter`: add child
- `F2`: focus title input
- `Delete`: delete node
- `Alt+ArrowUp` / `Alt+ArrowDown`: move up/down
- `Tab` / `Shift+Tab`: indent/outdent

## Export Behavior
- JSON export:
  - Serializes `db`, `selection`, and `assetsInline` (base64 blobs)
- JSON import:
  - Restores tree + selection + assets into IDB
  - Sanitizes imported note HTML content
- HTML export:
  - Inlines IDB image assets into note HTML
  - Inlines KaTeX CSS and applies fallback when bundled KaTeX fonts are missing

## KaTeX Notes
This project currently bundles `katex.min.css` and `katex.min.js` but not the KaTeX font files directory.
Current strategy:
- Keep rendering functional with serif fallbacks in-app and in export
- Do not hard-fail when KaTeX font assets are unavailable

## Known Limitations
- Formula authoring is via SunEditor/KaTeX only; legacy custom formula insertion was removed from app runtime.
- No test harness is included in this folder; validation is manual browser QA.
- localStorage fallback may fail for very large datasets on constrained environments.

## Maintenance Notes
- Keep changes scoped and reversible.
- Preserve compatibility of stored content when possible.
- Update this file after significant behavior or architecture changes.
