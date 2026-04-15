# Next Steps

Recommended checks for the next session:

1. Test JSON export/import end-to-end in a live browser.
2. Test Word export end-to-end in a live browser and inspect the downloaded `.docx`, especially for notation rendering, heading appearance, and the Calibri 10 / 1.27 cm defaults.
3. Test print/PDF output and confirm layout and graph images survive printing.
4. Hover and keyboard-focus each icon button and confirm the tooltip text is clear and not clipped.
5. Test graph types with simple data:
   - line
   - scatter
   - bar
   - bubble
   - pie
   - doughnut
   - polar area
   - radar
6. Manually drag a Section 4 column row with a real mouse/touch interaction and confirm the Sortable handle feels reliable outside automation.
7. Re-check the bubble-chart setup flow with a dataset that leaves one numeric column available for radius.
8. Open `instructions.html` once in a normal browser tab and do a quick visual pass for spacing and readability after the standalone-guide rewrite.
9. If more resume sessions are expected, decide whether `session_resume_2026-04-10/local_server.js` should stay as a testing utility or be removed after use.

Potential follow-up improvements:

- remove or rename the manual `Load` button if it is judged redundant
- consider renaming `Save` to `Save now` in the tooltip language if needed
- consider adding a small on-screen legend or help row for the toolbar icons
- consider adding parser support for more advanced notation if students need it
- consider adding browser-only resize handling if Tabulator still shows width issues in live testing
- consider whether the builder top bar should also drop the `practical_wu` / `tabulator_chart_resource` attribution text for end users

Known risk areas:

- tooltip clipping in narrow viewports
- Word export formatting for more complex notation combinations
- browser-specific download behaviour for JSON/Word/PDF actions
- less-used chart configurations, especially bubble charts with radius selection
- real-pointer drag behaviour on the new Section 4 Sortable handles, especially on touch devices
- final live appearance of the rewritten instructions page on smaller screens
