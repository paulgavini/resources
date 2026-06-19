# Blockly Character Movement

A small offline Blockly prototype for iPad students. Open `index.html` directly in a browser and drag blocks under `when run` to move the character around the stage.

## Run It

1. Open the `blockly-character-movement` folder.
2. Double-click `index.html`.
3. Drag movement blocks under `when run`.
4. Press `Run`.

No server, build step, npm install, CDN, React, Vite, or TypeScript is required.

## Offline Blockly Files

The app uses local Blockly files in `lib/blockly/`:

- `blockly_compressed.js`
- `blocks_compressed.js`
- `javascript_compressed.js`
- `msg/en.js`

If you need to replace or update Blockly, download Blockly from the official Blockly release package and place the required files in `lib/blockly/`.

## Asset Notes

The creature files in `assets/` are supplied original prototype assets for classroom testing. They do not use official Pokemon assets or names.

The app expects these local relative paths:

- `assets/static/walk_up.png`
- `assets/static/walk_down.png`
- `assets/static/walk_left.png`
- `assets/static/walk_right.png`
- `assets/gifs/walk_up.gif`
- `assets/gifs/walk_down.gif`
- `assets/gifs/walk_left.gif`
- `assets/gifs/walk_right.gif`
- `assets/spritesheets/walk_up_spritesheet.png`
- `assets/spritesheets/walk_down_spritesheet.png`
- `assets/spritesheets/walk_left_spritesheet.png`
- `assets/spritesheets/walk_right_spritesheet.png`
- `assets/reference/character_design_sheet.png`
- `assets/block_reference/movement_blocks_design_sheet.png`

## Teacher Editing Notes

- Blockly block definitions are in `js/blocks.js`.
- App logic and movement settings are in `js/app.js`.
- Styles are in `css/style.css`.
- The main movement constants are `GRID_SIZE`, `MOVE_DURATION`, and `PAUSE_DURATION`.
- The starter maze is defined by `DEFAULT_MAZE_LAYOUT` in `js/app.js`. `#` means wall, `S` means the character start square, `F` means finish, and `.` means open floor.
- The `Easy`, `Medium`, and `Hard` buttons set the random maze difficulty, and `New Maze` builds a fresh maze.
- `Sandpit` mode lets students edit the maze. Choose `Wall` or `Flag`, tap an empty square to place it, double tap a wall or flag to erase it, and drag the character to set the start square.
- Movement blocks include a dropdown field from `1` to `10`. For example, `move down 3` moves down three grid squares, one square at a time.
- The `repeat` block includes a dropdown field from `1` to `10` and repeats the blocks placed inside it.
- If a move would enter a wall or leave the maze, the program stops and shows `Ouch!` above the character.
- If the character reaches the finish flag, the program stops and shows `Great work!`.
