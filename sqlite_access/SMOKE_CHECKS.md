# DataNook smoke checks

Run these checks in Edge or another Chromium browser after a focused change. Use the school demo or a disposable database copy; do not experiment on a database with valuable data. Confirm that **All changes saved** appears before reloading.

## Startup and data entry

- [ ] Open the workspace. The school demo shows `students`, `courses`, and `enrollments`.
- [ ] Create a small table in Table Designer with an integer primary key and a text field.
- [ ] In Datasheet, choose the red × beside the selected table and confirm. Check that the table disappears and another table (or the empty state) is shown. Confirm cancellation keeps the table. Try deleting a referenced parent table and confirm the app asks you to remove incoming relationships first.
- [ ] Enter a value in Datasheet, paste a two-row tab-separated range, and reload. Confirm the rows remain.
- [ ] Search Datasheet across fields, sort a numeric field ascending and descending, and use Clear. Confirm filtered cells remain editable and a multirow paste saves the intended records.
- [x] Open first- and rightmost-column filters at desktop and 452 × 477 Edge viewports. Confirm popups stay fully visible, including Apply; apply a value filter and confirm its field shows a funnel icon, then use Clear and confirm all five demo rows return.

## CSV and database files

- [ ] Import a CSV from Table Designer. Confirm the first row supplies field names, quoted commas and multiline cells preview correctly, and the imported rows appear in Datasheet.
- [ ] Import a TSV and confirm tab detection, headers, and records.
- [ ] Try an existing table name. Confirm the importer reports the conflict and leaves the existing table intact.
- [ ] Open a disposable SQLite file. Confirm its tables and records appear; reload and confirm the browser copy remains.
- [ ] Use **Save as** to write a second file. Confirm the new file opens in a SQLite tool or back in DataNook.
- [ ] Use **New database** and choose a disposable location. Confirm it is blank, reload, and confirm the blank database remains.
- [ ] Cancel the Open picker and New database confirmation. Confirm the active database remains unchanged.
- [ ] Try opening an invalid `.sqlite` file. Confirm a readable error appears and the current database stays open.

## Access and Base workflows

- [ ] In Relationships, inspect existing links and create a test link between compatible fields in a disposable database.
- [ ] In Query Design, add related tables, run a join, and check a grouped Count or Sum.
- [ ] In SQL Editor, run a SELECT, save and reload its named query, and inspect the join diagrams.
- [ ] In Reports, create a preview from related fields and from a SQL result.
- [x] Open a table design from a Datasheet field heading, change the field name without saving, and choose Cancel. Confirm Datasheet returns and the original field name and records remain.
- [ ] Export each report preview to Excel and Word. Confirm the `.xlsx` and `.docx` files open and include the title, columns, group headings, summaries, and record count. Change a report option and confirm exports disable until a new preview is generated.

## Results from the 2026-10-21 file-workflow check

- CSV and TSV preview/import, first-row headers, quoted commas, and multiline CSV values passed with disposable fixtures.
- Open, Save as, New database, browser reload, Open picker cancellation, New confirmation cancellation, and invalid-file error handling passed in Edge on isolated localhost origins.
- New database initially failed because a native `window.confirm()` consumed the user gesture required by `showSaveFilePicker()`. The app now uses its HTML confirmation dialog; the picker opened and created a blank `.sqlite` file.
- `school-demo.sqlite` retained the same SHA-256 before and after the checks.
