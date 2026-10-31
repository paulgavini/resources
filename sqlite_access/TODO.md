# DataNook TODO

Keep DataNook a small, local, browser based SQLite workspace. Ship one focused improvement at a time and keep the existing school database usable throughout.

## Next

- [x] **Verify CSV and database file workflows end to end.** Using disposable files in Edge on isolated localhost origins, checked CSV/TSV preview and import (first-row headers, quoted commas, and multiline CSV), Open, New database, Save as, IndexedDB reload, and cancel/error paths. New database initially lost the browser gesture before `showSaveFilePicker()` because of a native confirmation; it now uses the app confirmation dialog. The school demo SHA-256 was unchanged. See [SMOKE_CHECKS.md](SMOKE_CHECKS.md).
- [x] **Add a small repeatable smoke-check list.** Added [SMOKE_CHECKS.md](SMOKE_CHECKS.md) for the app’s key startup, file, datasheet, relationship, query, and report workflows. No test framework added.

## Soon

- [x] **Delete a table safely.** Add a confirmed red × beside the selected Datasheet table; block deletion until incoming relationships are removed.
- [x] **Add basic Datasheet search and sorting.** Search across the selected table’s displayed values, sort by one field ascending or descending, and clear both with one action. Verified filtered edits and multirow paste in an isolated Edge test origin; no advanced filter builder added.
- [x] **Export report previews to Excel and Word.** Add `.xlsx` and `.docx` downloads for the current report, including title, source, selected fields, grouping headings, summaries, and record count. Export actions require a current preview.
- [x] **Filter Datasheet by field values.** Add searchable per-field value checklists that combine across columns, show an active funnel icon on filtered fields, and only affect displayed rows. Keep the existing Clear action for all view controls.
- [ ] **Let Query Design change join type.** Selecting a relationship connector should offer `INNER`, `LEFT`, and `RIGHT`, with a short explanation of which rows remain. Keep `FULL` and `CROSS` available in SQL Editor. Update generated SQL and the join diagram together.
- [ ] **Add a safe way to delete a record.** Start with deleting one selected row, a clear confirmation, and an undo action before leaving the table. Keep autosave and foreign-key behavior visible.
- [x] **Add Access-inspired Report Design View.** Added a section canvas with movable field controls, ordered group/sort levels, grouping intervals, group summaries, summary-only output, print options, and its own save/load/replace/delete catalog. See [REPORT_DESIGN_FEATURES.md](REPORT_DESIGN_FEATURES.md) for the researched feature list and implementation status.
- [x] **Add independent group band visibility and a group-value hide option.** Group settings control whether header/footer bands are designed and included in output. In the Group Header, check **Hide group value** to hide the generated heading; explicitly placed bound fields and static labels remain visible.
- [x] **Add text labels to report sections.** Labels can be placed in report, page, group, and detail bands, and are retained when a design is saved.
- [x] **Move Word and Excel exports into Report Design.** `.docx` and `.xlsx` exports use the generated design preview and include visible group/page sections and labels.
- [x] **Remove the old Reports workflow.** Removed the Reports tab, panel, handlers, and creation of its separate saved-report catalog. Older databases keep any legacy report rows already stored.
- [x] **Visually verify the requested Report Design updates in Edge.** Confirmed the checked **Hide group value** option removes the generated heading while preserving explicitly placed matching and unrelated group controls and static labels. The separate whole-header output toggle still removes the entire band. Earlier checks confirmed named fields, labels in all seven section types, five correct rows from a students-only source, save/load/delete, and Word/Excel download success messages.
- [ ] **Check Report Design responsive sizing and browser print preview in Edge.** These still need a focused visual pass at a narrow viewport and in Edge's print preview.

## Later

- [ ] **Add a Visuals tab with interactive charts and slicers.** Use a table or SQL query as the source. Start with KPI cards, bar charts, detail tables, and slicers that filter the visuals; add line charts when the source has useful date data. Keep calculations and filters in the browser without changing user tables.
- [ ] **Create a simple form from one table.** Show one record at a time with Previous, Next, New, and Save actions. Use the table’s existing field names and types; defer layout design and multi-table subforms.

## Leave out for now

- Multi-user editing, accounts, server storage, and cross-device synchronization.
- Macros or scripting, Access file compatibility, external database connections, and a fully freeform report canvas/property sheet with arbitrary control placement and styling.
- Automatic CSV type guessing. SQLite uses type affinity rather than strict column types, so keep imported values as text unless a later, explicit conversion tool can preview and confirm changes.

## Research notes

- Access query design automatically joins related sources and lets users change a join between matching rows, all left-side rows, or all right-side rows. This supports a small three-choice join control in Query Design; the SQL Editor can keep the wider SQLite join vocabulary. [Microsoft Access: Join tables and queries](https://support.microsoft.com/en-us/access/join-tables-and-queries)
- Access forms are commonly bound to an existing table or query. A single-table record form is a useful first form feature; subforms and custom design tools can wait. [Microsoft Access: Create a form](https://support.microsoft.com/en-us/access/create-a-form-in-access)
- LibreOffice Base treats tables, queries, forms, and reports as distinct database objects, and its table view supports editing records, sorting, filtering, and finding values. [LibreOffice Base: Tables](https://help.libreoffice.org/latest/en-US/text/sdatabase/05000000.html) · [LibreOffice Base: Database overview](https://help.libreoffice.org/latest/en-US/text/sdatabase/main.html)
- SQLite columns use flexible type affinity; declared types guide storage but do not strictly constrain every value. SQLite also intentionally has a limited `ALTER TABLE` set. Preserve the current careful schema rebuild/guard approach and avoid surprising import conversions. [SQLite: Datatypes](https://www.sqlite.org/datatype3.html) · [SQLite: ALTER TABLE](https://sqlite.org/lang_altertable.html)
- The browser Save File Picker is not supported in every browser context and requires a secure context and a direct user action. Keep IndexedDB and download/upload fallbacks, and validate both paths. [MDN: `showSaveFilePicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker)
