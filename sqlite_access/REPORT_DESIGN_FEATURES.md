# Report Design View feature plan

## Access research summary

Microsoft Access **Report Design View** separates a report into bands with different lifetimes: Report Header/Footer appear once for the whole report, Page Header/Footer repeat per page, Group Header/Footer surround each matching group, and Detail repeats for every source record. Access automatically names group bands after their grouping field. The Group, Sort, and Total pane supports up to ten ordered levels, field-type-specific grouping intervals, optional group headers/footers, totals, and page-break behavior. Totals include record/value counts, Sum, Average, Minimum, Maximum, grand totals, and percent of grand total; Detail can be hidden for summary output. In Design View, Access supports bound fields and static labels among other controls. Microsoft's formatted export action supports `.xlsx` and RTF for reports (which Word opens); DataNook exports `.xlsx` and `.docx` from its preview.

Sources:

- [Create a grouped or summary report](https://support.microsoft.com/en-us/access/create-a-grouped-or-summary-report)
- [Introduction to reports in Access](https://support.microsoft.com/en-us/access/introduction-to-reports-in-access)
- [Guide to designing reports](https://support.microsoft.com/en-us/access/guide-to-designing-reports)
- [Create a simple report](https://support.microsoft.com/en-us/access/create-a-simple-report)
- [Modify, edit, or change a report](https://support.microsoft.com/en-us/access/modify-edit-or-change-a-report)
- [Insert page numbers into a report](https://support.microsoft.com/en-us/access/insert-page-numbers-into-a-report)
- [Export data to Excel](https://support.microsoft.com/en-us/access/export-data-to-excel)
- [Export data to a text file](https://support.microsoft.com/en-us/access/export-data-to-a-text-file)
- [ExportWithFormatting macro action](https://support.microsoft.com/en-us/access/exportwithformatting-macro-action)

## Feature list and delivery order

| # | Feature | Status |
|---|---|---|
| 1 | Add a dedicated Report Design tab with a section canvas for Report Header, Page Header, Group Header, Detail, Group Footer, Report Footer, and Page Footer. Add bound fields to any section, move them between sections, and reorder/remove controls. | Implemented; Edge visually confirms all seven sections, field destination selection, and named group fields. In the checked **Hide group value** case, Edge preview shows explicitly placed matching and unrelated fields in the Group Header without field-name prefixes. |
| 2 | Add up to ten ordered group/sort levels with field selection, direction, move up/down, and removal; group levels add configurable header/footer sections whose output can be hidden independently. | Implemented; group settings control whether each band exists in the design and whether it appears in preview/exports. The Group Header checkbox hides only the generated heading while retaining explicitly placed fields and labels; the separate output checkbox hides the complete band. Edge verified the checked option with matching and unrelated bound fields present. |
| 3 | Add Access-style grouping intervals: date parts, first one to five text characters, and numeric ranges. | Implemented; Edge confirms Week and first-character grouping output plus numeric range grouping output (1-unit buckets on credits). |
| 4 | Add per-group and report-level totals: record counts, Sum/Avg/Min/Max/Count Values, grand totals, and percent-of-grand-total summaries. | Implemented with one selected value summary per level; Edge confirms group counts, Sum, Average, Minimum, Maximum, summary-only Count Values grand total, grand totals, and percent-of-grand-total output. |
| 5 | Add summary-only output and print controls for keeping groups together or keeping headers with the first record. Page headers and footers repeat in print layout. | Edge confirms summary-only layout and grand-total fit. Browser print preview was not reached; keep-whole depends on browser pagination; repeat group headers after a page split remains planned. A bound field placed in Page Header currently uses the first result row; Page Footer uses the last row. |
| 6 | Add save, load, replace, and delete for design definitions in a dedicated portable app-managed table. Query-based designs restore after their saved SQL is run. | Implemented; Edge save/load/delete round trip preserved section labels and independent hidden-band settings. Disposable QA design was deleted, and the existing saved design remained. |
| 7 | Add static text labels to any section, including both group bands, Detail, report-level bands, and page-level bands. | Implemented; Edge confirms labels in Report Header, Page Header, Group Header, Detail, Group Footer, Report Footer, and Page Footer; labels appeared in preview. |
| 8 | Export the current Report Design preview to Excel (`.xlsx`) and Word (`.docx`). | Implemented; Edge reports successful `.xlsx` and `.docx` downloads from the current preview with visible group/page sections and labels. |
| 9 | Retire the previous Reports tab and its separate report builder, leaving Report Design as the report workflow. | Implemented; the tab, panel, event handlers, and creation of its old catalog have been removed. Existing legacy catalog data remains preserved inside older databases and is protected from direct SQL edits. |
| 10 | Visually review desktop/tablet layouts, save/load behavior, related-table and query sources, group output, labels, exports, and printing in Edge; record refinements. | Requested features are visually checked on desktop in Edge. Found and fixed a query issue where an inactive grand-total field could join related rows; a students-only report now shows the source's five records. Responsive sizing and browser print preview still need a focused pass. Page Header fields currently use the first result row; Page Footer fields use the last row. |
| 11 | Add page numbers, date/time and calculated controls, formatting and positioning properties, page-size/margin settings, multiple summaries, standard-deviation/variance summaries, and repeat group headings after page breaks. | Later |

Report Design is the only report workflow. Its versioned JSON lives in the hidden `__APP_SAVED_REPORT_DESIGNS_DO_NOT_EDIT` table and travels with the database. Existing databases may still contain `__APP_SAVED_REPORTS_DO_NOT_EDIT` from the retired tab; the app leaves those records untouched, does not create that table for new databases, and no longer offers the old builder. Static labels and Office exports are in scope now; page numbers, free positioning, and a broad property sheet remain later work.

