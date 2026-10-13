# Concept Mapper TODO and Feature Roadmap

This roadmap uses Mindomo and Freeplane as feature references. It adapts ideas that fit this project rather than aiming to reproduce either product. The current app is a plain HTML, JavaScript, and CSS editor with a local-first JSON file workflow. Keep new features compatible with that approach unless the project direction changes.

## Priorities

- **P0 — Core concept mapping:** required to represent ideas and their relationships faithfully.
- **P1 — Everyday research and editing:** improves longer study maps, navigation, and accessible editing.
- **P2 — Sharing work with other tools:** makes maps easier to reuse, print, teach from, and style.
- **P3 — Optional extensions:** valuable features that add complexity or need a backend or a separate design decision.

## Existing features

- [x] Blank map with a central concept and an automatically laid out branching map.
- [x] Map and Outline views use the same topic tree.
- [x] Add, edit, delete, select, undo, and redo concepts; use keyboard shortcuts; pan, zoom, and fit the map.
- [x] Reorder and nest topics with drag and drop in Outline.
- [x] Separate topic headings and rich notes, including bold, italic, bulleted and numbered lists, superscript, and subscript.
- [x] Recover maps from browser storage; load or save JSON files, autosave a linked file in supported browsers, and detect outside file changes.
- [x] Export an SVG map image and a Word document with heading levels based on map depth.
- [x] In-app Help guide.

## P0 — Core concept mapping

### Add relationships between any two concepts

- [ ] Let users connect two existing topics even when one is not the other's parent or child.
- [x] Let users label a parent-child connection with a short relationship phrase, so the connection reads as a proposition (for example, “reduces” or “depends on”).
- [ ] Let users select, edit, and remove a relationship without deleting either topic.
- [ ] Render relationship lines and labels clearly alongside the existing tree connectors. Keep connectors readable while the map is zoomed, panned, resized, and exported.
- [ ] Store relationship IDs, endpoint topic IDs, labels, and any presentation settings in the map file. Add import migration and validation for older maps that have no relationships.
- [ ] Include relationship changes in undo/redo and warn before deleting a topic that has relationships, or remove those connections as part of the undoable delete.
- [ ] Provide a keyboard-accessible way to create a connection and choose its second endpoint.

**Ready when:** a user can link topics in different branches, add a meaningful label, save and reload the map without losing it, undo/redo the change, and see the same connection in SVG export.

## P1 — Everyday research and editing

### Search and focus

- [ ] Search topic headings and notes in the current map.
- [ ] Show the matching topics, highlight each match, and navigate between results.
- [ ] Offer a non-destructive focus/filter view that keeps the matching topics and their ancestors visible; include an obvious way to clear the filter and restore the full map.
- [ ] Add a “focus on branch” action that temporarily hides other branches and can return to the whole map.

### Link topics to research sources

- [ ] Add one or more labeled web links to a topic, separate from its heading and notes.
- [ ] Display a clear link indicator and make links available in both Map and Outline views.
- [ ] Validate URLs and open external links safely. Include link labels and URLs in JSON and relevant exports.
- [ ] Consider internal links between topics as a follow-up to cross-branch relationships; avoid making two features that look identical but behave differently.

### Improve topic editing and navigation

- [ ] Add a keyboard-accessible alternative to Outline drag and drop for moving a topic before, after, or inside another topic.
- [ ] Add branch-level collapse/expand and a clear “expand all / collapse all” command.
- [ ] Add a duplicate-topic or duplicate-branch command that preserves notes and descendants, with new unique IDs and undo support.
- [ ] Consider direct in-place heading editing to reduce the number of dialog steps; keep the existing dialog for notes and detailed editing.
- [ ] Add “center selected topic” and “fit whole map” actions that are distinct and predictable.
- [ ] Review keyboard focus order, screen-reader labels, contrast, and touch targets in both views.

### Add saved manual layout positions

- [ ] Allow users to reposition map topics while preserving their parent/child structure and any cross-branch relationships.
- [ ] Save position overrides in JSON; keep automatic layout as the default for new topics and offer a reset-to-automatic-layout action.
- [ ] Ensure moving a topic does not make its connectors obscure headings or relationship labels.

**Ready when:** a large research map can be searched, narrowed to a branch, rearranged without a mouse, and each topic can hold a link to its source.

## P2 — Reuse, print, and presentation

### Import and export formats

- [ ] Export a Markdown outline with nested headings/lists and notes under the relevant topic.
- [ ] Import and export OPML for exchanging hierarchical outlines with other tools.
- [ ] Consider Freeplane `.mm` import/export after the app's data model supports notes and relationships reliably; define how unsupported styles, icons, links, and relationship types are handled before implementation.
- [ ] Add a print-friendly layout and “Save as PDF” through browser printing, with page size/orientation, fit-to-page, and readable multi-page options.
- [ ] Add PNG export at selectable resolution if users need a raster image; retain SVG as the scalable option.
- [ ] Add export options to include/exclude notes and links, and document any information a format cannot preserve.

### Templates

- [ ] Offer optional starter templates for common study workflows, such as essay planning, a science report, and a research/source map.
- [ ] Keep the default opening map blank. Templates should be chosen explicitly and remain editable like any other map.
- [ ] Allow users to save a map as a reusable template after styles and structure are supported.

### Topic markers and styles

- [ ] Add a small, accessible marker set for concepts such as question, evidence, example, important, and needs a source.
- [ ] Add topic styles that can be reused and copied, with a restrained selection of color and shape choices consistent with `theme.md`.
- [ ] Make marker/style meanings visible in a compact key and preserve them in JSON and exports that support them.
- [ ] Consider tags or simple key/value attributes for categorising topics; allow search/filtering by them before building more advanced metadata tools.

### Present and review a map

- [ ] Add a presentation mode that steps through selected branches or saved presentation stops, expands the current topic, and keeps the rest of the map out of the way.
- [ ] Let users preview a presentation sequence before starting and return to the map without changing its structure.

**Ready when:** a user can start from a blank map or an optional template, exchange the hierarchy with outline tools, print a readable map, and present a focused branch.

## P3 — Larger product extensions

- [ ] Add a local map library for multiple maps, with recent files, duplicate, rename, and safe recovery actions. Keep file operations transparent and compatible with the existing linked-JSON workflow.
- [ ] Consider image and document attachments. Decide how assets are packaged with a map before implementing drag-and-drop files; JSON-only links cannot safely carry arbitrary file assets by themselves.
- [ ] Consider comments and collaboration only if a backend, identity, permissions, and conflict handling are in scope. Real-time co-editing and sharing in Mindomo rely on shared-workspace behavior outside this standalone app's current architecture.
- [ ] Consider task fields (status, priority, dates, assignee) only if Concept Mapper is also meant to manage work. These fields would substantially change the product from a study concept mapper.
- [ ] Consider LaTeX/math notation for science learning maps; first decide whether formulas are rendered in notes, headings, or both, and how they export.
- [ ] Consider richer Freeplane-style node details, attributes, and conditional styles only after user research shows that heading + notes + source links are insufficient.

## Research basis

The most directly relevant Mindomo concept-map features are freely positioning topics, connecting any two topics, and labeling connecting lines to describe their relationship. Those capabilities motivate the P0 relationship work and P1 saved manual positions. See [Working with Concept Maps](https://help.mindomo.com/basics/working-with-concept-maps/).

Mindomo's feature documentation also highlights outline editing, notes, links and attachments, keyboard shortcuts, full-text search, filtering, branch drill-down, templates, multiple export formats, and presentation use. Its education material describes how notes, hyperlinks, multimedia, icons, printing, and presentation fit into study workflows. See [Mindomo education features](https://www.mindomo.com/edu/features/) and [Getting started with Mindomo](https://help.mindomo.com/getting-started/).

Freeplane's documentation shows a broad desktop workflow around a notes panel, filter/search controls, icon panel, formatting and attributes panels, plus reusable and conditional styles. This supports the staged search, markers, attributes, and styles items above; the roadmap keeps advanced metadata and conditional styling lower priority. See [Freeplane interface](https://docs.freeplane.org/attic/new-wiki-initiative/understanding-interface.html), [Styles](https://docs.freeplane.org/user-documentation/styles.html), and [Formatting maps and nodes](https://docs.freeplane.org/user-documentation/formatting-maps-and-nodes.html).

Freeplane also supports hyperlinks to other nodes, separate details and notes, and a broad set of import/export formats. These are useful references for later interoperability, but the current app should first stabilize its own relationship and notes model. See [Freeplane links to nodes](https://docs.freeplane.org/user-documentation/links-to-nodes.html), [Text, details, and notes](https://docs.freeplane.org/scripting/scripting_examples/text_details_note.html), and [Working with mind-map files](https://docs.freeplane.org/user-documentation/working-w-mindmap-files.html).

Mindomo's Word export can include notes, images, icons, task attributes, and a hyperlinked table of contents; its Markdown and OPML exports preserve hierarchical structure. These references inform the export work above. See [Export Mind Maps](https://help.mindomo.com/basics/export-mind-maps/).

## Source links

- [Mindomo: Working with Concept Maps](https://help.mindomo.com/basics/working-with-concept-maps/)
- [Mindomo: Working with Mind Maps](https://help.mindomo.com/basics/working-with-mind-maps/)
- [Mindomo: Education features](https://www.mindomo.com/edu/features/)
- [Mindomo: Getting started](https://help.mindomo.com/getting-started/)
- [Mindomo: Export Mind Maps](https://help.mindomo.com/basics/export-mind-maps/)
- [Freeplane: User documentation](https://docs.freeplane.org/user-documentation/user-documentation.html)
- [Freeplane: Interface](https://docs.freeplane.org/attic/new-wiki-initiative/understanding-interface.html)
- [Freeplane: Links to nodes](https://docs.freeplane.org/user-documentation/links-to-nodes.html)
- [Freeplane: Styles](https://docs.freeplane.org/user-documentation/styles.html)
- [Freeplane: Formatting maps and nodes](https://docs.freeplane.org/user-documentation/formatting-maps-and-nodes.html)
- [Freeplane: Working with mind-map files](https://docs.freeplane.org/user-documentation/working-w-mindmap-files.html)
