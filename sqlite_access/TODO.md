# DataNook TODO

Keep DataNook a small, local, browser based SQLite workspace. Ship one focused improvement at a time and keep the existing school database usable throughout.

## Next

- [x] **Verify CSV and database file workflows end to end.** Using disposable files in Edge on isolated localhost origins, checked CSV/TSV preview and import (first-row headers, quoted commas, and multiline CSV), Open, New database, Save as, IndexedDB reload, and cancel/error paths. New database initially lost the browser gesture before `showSaveFilePicker()` because of a native confirmation; it now uses the app confirmation dialog. The school demo SHA-256 was unchanged. See [SMOKE_CHECKS.md](SMOKE_CHECKS.md).
- [x] **Add a small repeatable smoke-check list.** Added [SMOKE_CHECKS.md](SMOKE_CHECKS.md) for the app’s key startup, file, datasheet, relationship, query, and report workflows. No test framework added.

## Soon

- [x] **Delete a table safely.** Add a confirmed red × beside the selected Datasheet table; block deletion until incoming relationships are removed.
- [x] **Add basic Datasheet search and sorting.** Search across the selected table’s displayed values, sort by one field ascending or descending, and clear both with one action. Verified filtered edits and multirow paste in an isolated Edge test origin; no advanced filter builder added.
- [ ] **Let Query Design change join type.** Selecting a relationship connector should offer `INNER`, `LEFT`, and `RIGHT`, with a short explanation of which rows remain. Keep `FULL` and `CROSS` available in SQL Editor. Update generated SQL and the join diagram together.
- [ ] **Add a safe way to delete a record.** Start with deleting one selected row, a clear confirmation, and an undo action before leaving the table. Keep autosave and foreign-key behavior visible.

## Later

- [ ] **Create a simple form from one table.** Show one record at a time with Previous, Next, New, and Save actions. Use the table’s existing field names and types; defer layout design and multi-table subforms.
- [ ] **Save report setup.** Save and reopen a report title, selected fields, grouping, summary, and sort order. Keep the existing print/PDF preview as the output.

## Leave out for now

- Multi-user editing, accounts, server storage, and cross-device synchronization.
- Macros or scripting, Access file compatibility, external database connections, and an open-ended visual report designer.
- Automatic CSV type guessing. SQLite uses type affinity rather than strict column types, so keep imported values as text unless a later, explicit conversion tool can preview and confirm changes.

## Research notes

- Access query design automatically joins related sources and lets users change a join between matching rows, all left-side rows, or all right-side rows. This supports a small three-choice join control in Query Design; the SQL Editor can keep the wider SQLite join vocabulary. [Microsoft Access: Join tables and queries](https://support.microsoft.com/en-us/access/join-tables-and-queries)
- Access forms are commonly bound to an existing table or query. A single-table record form is a useful first form feature; subforms and custom design tools can wait. [Microsoft Access: Create a form](https://support.microsoft.com/en-us/access/create-a-form-in-access)
- LibreOffice Base treats tables, queries, forms, and reports as distinct database objects, and its table view supports editing records, sorting, filtering, and finding values. [LibreOffice Base: Tables](https://help.libreoffice.org/latest/en-US/text/sdatabase/05000000.html) · [LibreOffice Base: Database overview](https://help.libreoffice.org/latest/en-US/text/sdatabase/main.html)
- SQLite columns use flexible type affinity; declared types guide storage but do not strictly constrain every value. SQLite also intentionally has a limited `ALTER TABLE` set. Preserve the current careful schema rebuild/guard approach and avoid surprising import conversions. [SQLite: Datatypes](https://www.sqlite.org/datatype3.html) · [SQLite: ALTER TABLE](https://sqlite.org/lang_altertable.html)
- The browser Save File Picker is not supported in every browser context and requires a secure context and a direct user action. Keep IndexedDB and download/upload fallbacks, and validate both paths. [MDN: `showSaveFilePicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker)
