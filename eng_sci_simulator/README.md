# QuakeLab

QuakeLab is an offline, browser-based structural engineering simulator for secondary-school classrooms. Students build a simplified 2D frame, apply sinusoidal shake-table motion, observe relative loading and component failure, then modify and retest their design.

## Run it

No installation, account, or internet connection is required.

- Double-click `index.html` to run directly in a modern browser, or
- from this folder run `python3 -m http.server 8000` and open `http://localhost:8000`.

The root `index.html` also makes the project ready for GitHub Pages deployment.

## Student workflow

1. Place fixed **Floor Joints** on the shake table and movable **Joints** above them.
2. Select a material and add floors, braces, and payload masses.
3. Set amplitude, frequency, duration, and damping.
4. Run the earthquake test and inspect motion, simplified relative loading, failures, and graphs.
5. Review the result, modify the design, and retest.

The shake table includes a permanent physical ground surface. Use the **Floor Joint** tool to create fixed foundation connections that receive the table's horizontal motion. The previous Floor member tool has been removed because the permanent ground makes it redundant.

Closing the results window automatically resets the tested structure to its original geometry and returns the workspace to editable Design Mode. The completed response graph remains visible until the next test begins.

Designs save as portable JSON files. Test histories export as CSV.

Use the **Sensor** tool and tap up to four joints or structural members to record their signed horizontal displacement relative to the moving shake table. The four numbered, colour-coded readings appear in Live Measurements, can be selected individually in the response graph, and are included as separate columns in the CSV export. Workspace distances are converted using 100 pixels per metre, so every reported displacement uses millimetre-equivalent units consistently.

Sensors and masses can also attach directly to any position along a beam or brace. A beam sensor interpolates between the member's two endpoints and adds no physics body or hinge. A beam mass is distributed to the endpoint bodies according to position: for example, a centred 500 kg mass contributes 250 kg to each endpoint.

Select the **Mass** tool and tap an existing mass to open its editor. Masses can be increased or decreased in 100 kg intervals, entered directly in multiples of 100 kg from 100–5,000 kg, or removed independently without deleting the supporting joint or member.

## Survival decision

The current classroom model reports survival only when all four limits are met: maximum roof sway is no more than 160 mm, maximum relative storey drift is no more than 80 mm, no more than 25% of members fail, and the structure retains at least 65% of its original height. The results screen identifies any limit that caused failure. These are transparent educational comparison thresholds, not building-code criteria.

## Controls

The simulator uses Pointer Events for mouse, trackpad, touch, and stylus input. Keyboard shortcuts are shown on the tool buttons. `Ctrl/Cmd + Z` undoes the last design edit.

The **? Guide** button opens `student-guide.html` in a separate window or tab. This standalone guide contains the full student handout, responsive tablet layout, troubleshooting reference, and print styling.

## Educational model

QuakeLab uses Matter.js rigid bodies and constraints with simplified stiffness, strength, damping, density, and cost values. A classroom failure layer monitors relative member deformation and releases constraints when thresholds are exceeded. Displayed loading and failure thresholds are comparative abstractions. The simulator is not finite-element software and must not be used for professional design or safety decisions.

Peak table acceleration is calculated from the displayed real-world equivalents using `a = (2πf)²A`, then shown relative to gravitational acceleration.

## Main files

- `index.html` — application interface and accessible controls
- `student-guide.html` — complete browser-based and printable student guide
- `css/style.css` — responsive visual system
- `js/materials.js` — comparative material properties
- `js/app.js` — builder, simulation, measurements, graphing, failures, and save/load
- `lib/matter.min.js` — locally stored Matter.js 0.20.0 physics engine
