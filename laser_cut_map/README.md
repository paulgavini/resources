# Taylors' laser-cut maze maker

This is a local offline web app for creating a laser-cuttable maze as a true-size SVG or PDF. The default design is 90 mm x 90 mm with 5 mm paths.

## Open the app

Open `index.html` in a web browser. No internet connection, server, build tool, framework, CDN or external library is required.

## Generate a maze

Set **Base width**, **Base height** and **Path width**, then select **Apply dimensions**. The base width and height must divide evenly by the path width, and the calculated grid must have an even number of rows and columns. This keeps all geometry aligned to the laser-cutting grid.

Select **Auto-generate maze** to create a solvable maze on the calculated grid. The generated maze uses one-square-wide paths, spreads across the usable inner platform, and keeps the whole outside border blank so a ball bearing cannot fall out. The start and finish cells are inside the border and are marked with centred dots. The exported SVG uses millimetre dimensions and a matching viewBox for the current base size.

## Use Designer Mode

Select **Designer Mode** to draw your own path.

- Single-click a grid square to place a path cell.
- Double-click a placed square to remove it.
- After removing a square, single-click the gap to add it back if it touches the remaining path.
- **Undo** removes the most recent placement.
- **Clear** resets the design.
- With **Branch Mode** off, each new square must touch the previous square.
- With **Branch Mode** on, each new square may branch from any existing path square.

For a valid design, keep every outside border square blank. Start one square in from the left border and continue until the path reaches one square before the right border. Designer Mode shows clear warnings when the path is disconnected, uses the outside border, has no start, has no finish, or does not form a continuous route from start to finish.

## Validate

Select **Validate Design** before exporting. The app checks the current true-size canvas, calculated grid, path width, blank outside border, one-square-wide paths, generated-maze platform coverage, start, finish, solvability, one connected removable cut-out path, one connected remaining white-material piece, continuous outer frame, centred start and finish dots, red cut paths, black start and finish dots, the exact PDF MediaBox for the current dimensions, vector-only PDF drawing commands, and that SVG and PDF exports are generated from the same geometry.

The validation is deliberately conservative because laser-cut safety matters more than maze complexity.

## Export

- **Download SVG** exports a true-size SVG with red cut lines and black start/finish dots.
- **Download PDF** exports a direct vector PDF with a true-size page, red cut lines and black start/finish dots.

The PDF is generated manually in JavaScript. It does not use jsPDF or any external library. The SVG and PDF renderers both receive the same internal geometry object before download. The PDF page uses 1 mm = 72 / 25.4 points and a MediaBox calculated from the current base dimensions. With the default 90 mm x 90 mm design, the MediaBox is `[0 0 255.1181102362 255.1181102362]`. All exported PDF maze geometry is written as vector path commands.

## Check in laser cutting software

After importing the SVG or PDF into your laser cutting software, check the document or selected artwork size before cutting. It should match the base width and height shown in the app. If the software imports in pixels or scales the artwork, set the physical size back to the exact base dimensions before assigning cut settings.
