# PDF Draw Editor

Small browser-based PDF annotator built with HTML, CSS, and JavaScript.

## What it does

- Open a PDF from the file picker
- Create a blank PDF with a chosen page count
- Draw freehand annotations on each page
- Erase marks
- Toggle a 1cm page grid on/off
- Undo and redo strokes per page
- Move between PDF pages
- Save a new annotated PDF

## Files

- `index.html`: app shell
- `styles.css`: layout and styling
- `script.js`: PDF loading, drawing, history, and export logic
- `page.pdf`: sample PDF you can use for testing

## How to run

Open `index.html` in a browser.

If your browser blocks some features when opening the file directly, run the folder from a small local web server instead. For example, with Python installed:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Notes

- The app includes local copies of `pdf.js` and `pdf-lib` in `vendor/` for offline use.
- Saved annotations are merged into the exported PDF pages.
