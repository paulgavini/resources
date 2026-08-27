# QuakeLab Project Resume

Last updated: 27 August 2026  
Project folder: `eng_sci_simulator`

## Project purpose

QuakeLab is a browser-based educational earthquake engineering simulator for Year 9 Science and Engineering students. Students build simplified structures, apply controlled shaking, collect sensor measurements, compare design choices and improve their structures through experimentation.

The simulator is an educational comparative model. It is not suitable for professional structural design, code compliance or real-world safety decisions.

## Current application

Main files:

- `index.html` — simulator interface
- `student-guide.html` — student-facing application guide
- `js/app.js` — building, physics, testing, sensors, masses and results
- `js/materials.js` — material properties and costs
- `lib/matter.min.js` — local Matter.js physics library
- `css/style.css` — main interface styling
- `css/student-guide.css` — guide styling
- `css/mass-editor.css` — mass editor and related styling
- `README.md` and `STUDENT_GUIDE.md` — supporting documentation

The application is self-contained and can operate offline because Matter.js is stored locally.

## Implemented features

### Structure-building tools

- Select and move
- Joint
- Floor Joint
- Beam
- Brace
- Mass
- Up to four sensors
- Delete
- Pan, zoom and fit view
- Undo and redo

The old Floor tool was removed. Structures must begin with Floor Joints, which are fixed to the moving shake table.

### Payload masses

- Masses can be placed on joints or at any position along a member.
- A member-mounted mass is distributed between the two endpoint joints and does not create an additional hinge.
- Masses are adjustable in 100 kg intervals.
- Valid range: 100–5,000 kg.
- Select Mass and tap an existing mass label to edit or remove it.

### Sensors

- Up to four sensors can be attached to joints or positions along members.
- Sensors do not introduce joints or movement points.
- Each sensor reports signed horizontal displacement relative to the shake table.
- Positive and negative values indicate direction.
- Sensor readings can be selected for the response graph.
- Sensors can be removed from the Live Measurements panel.

### Materials and costs

Current classroom values:

| Material | Cost per metre-equivalent | Strength | Stiffness | Weight | Damping |
|---|---:|---:|---:|---:|---:|
| Timber | $10 | 0.62 | 0.60 | 0.35 | 0.55 |
| Steel | $30 | 0.95 | 0.92 | 0.88 | 0.25 |
| Reinforced | $22 | 0.84 | 0.80 | 0.72 | 0.42 |
| Lightweight | $7 | 0.42 | 0.38 | 0.18 | 0.68 |

The interface displays the cost of the selected material and the calculated total structure cost.

### Earthquake controls

- Amplitude: 1–100 mm
- Frequency: 0.2–10 Hz
- Duration: 1–30 seconds
- Structural damping: 1–25%
- Peak table acceleration is calculated and displayed in `g`.

### Testing and member failure

During a test, a member turns red and displays an exclamation mark when it exceeds its simplified material deformation limit. Its physics constraint is removed, so it stops carrying load for the rest of that test.

One failed member does not automatically mean that the entire structure has failed. The final result applies four classroom survival checks:

- Maximum roof sway ≤ 160 mm
- Maximum relative storey drift ≤ 80 mm
- Failed members ≤ 25% of all members
- At least 65% of the original structure height retained

After testing, closing the results returns the structure to editable Design Mode. Reset also restores the structure for modification and retesting.

### Saving and results

- Save and load designs as JSON.
- Export recorded response data as CSV.
- CSV fields include time, four sensors, roof displacement, table displacement and table acceleration.

## Student guide behaviour

The **? Guide** control in `index.html` now uses a normal link with `target="_blank"`, so `student-guide.html` opens in a new browser tab instead of a sized pop-up window.

The guide includes instructions for:

- Foundations and Floor Joints
- Drawing beams and braces
- Materials and costs
- Adding, changing and removing masses
- Placing and interpreting sensors
- Configuring an earthquake
- Running and interpreting a test
- Understanding a red failed member with an exclamation mark
- Modifying and retesting
- Saving, loading and exporting

## Student task workbook

Final resources:

- `student-resources/Year_9_Earthquake_Engineering_Student_Task.docx`
- `student-resources/Year_9_Earthquake_Engineering_Student_Task.pdf`
- Original diagrams in `student-resources/assets/`

The current workbook is a 15-page individual Year 9 task. It includes:

- Earthquake forces and Australian context
- Load paths, strength, stiffness, ductility and energy control
- Simulator investigation routine and fair testing
- Investigation 1: frames and triangulation
- Investigation 2: materials, performance and cost
- Investigation 3: mass and mass position
- Investigation 4: frequency, natural period and resonance
- Individual open-ended Resilient Community Hub Challenge
- Concept sketch and design reasoning
- Three-version testing and improvement record
- Engineering evidence report
- 20-mark rubric and individual reflection
- Trusted research sources

The dedicated section titled **How real buildings resist earthquakes** was removed at the user's request. The challenge still contains a shorter requirement to apply and cite at least two earthquake-resistant design principles.

All team wording was removed. The cover identifies it as an individual task, and the former peer-feedback fields are now individual reflection fields.

The workbook generator is:

- `tools/generate_student_task.py`

It uses `python-docx`, Pillow and supporting packages that were temporarily installed under `/private/tmp/quakelab_doc_deps`. If that temporary folder is unavailable in a later session, reinstall the dependencies or use the available document-generation runtime.

The final Word document was exported through Microsoft Word and visually checked page by page as a PDF. The current rendered version contains 15 clean pages with no blank, clipped or overflow pages.

## Research used for the workbook

Authoritative starting sources include:

- Geoscience Australia — earthquakes and Australian earthquake context
- Geoscience Australia — National Seismic Hazard Assessment
- Geoscience Australia — resilience of older masonry buildings
- FEMA / NEHRP — *Earthquake-Resistant Design Concepts (FEMA P-749)*
- U.S. Geological Survey — earthquake effects and frequency response of different-sized buildings
- EarthScope Consortium / IRIS — building resonance

Links are included on the final page of the workbook.

## Important implementation details

- The physics engine is Matter.js.
- Graphing is implemented with the app's existing Canvas JavaScript rather than Chart.js.
- Sensor movement is calculated as horizontal attachment displacement relative to its initial position and the moving table.
- Beam-mounted sensors and masses use a fractional position along the member.
- Materials selected in the palette apply to newly drawn members; existing members are not automatically changed.
- A test uses sinusoidal table motion. Peak acceleration follows `(2πf)²A / g`.
- Increasing frequency while holding amplitude constant also increases peak acceleration, so frequency-sweep results are not a perfectly isolated resonance experiment. The workbook explicitly asks students to identify this limitation.

## Validation notes

- The latest `index.html` and `student-guide.html` parse as HTML.
- JavaScript syntax was not checked with Node during the last change because Node was not installed in the environment; the most recent JavaScript edit only removed the obsolete Guide pop-up handler.
- The Guide now works through native HTML link behaviour, so it does not depend on JavaScript or pop-up permissions.
- The final DOCX archive passed `unzip -t` without errors.
- The final student task PDF was visually inspected after the most recent individual-task revision.
- The project directory was not recognised as a Git repository during the last status check.

## Suggested next-session checks

1. Open `index.html` in the in-app browser or serve the folder locally.
2. Confirm the Guide opens in a separate tab on desktop and iPad Safari.
3. Build a small braced frame from Floor Joints and run a short test.
4. Confirm a failed member becomes red with `!` and that Reset restores it.
5. Check masses at 100 kg and 5,000 kg and verify editing/removal.
6. Place four sensors, test, and export the CSV.
7. Open the latest Word and PDF student task files and confirm they remain at 15 pages.

## Potential future work

- Add a direct download link for the student task PDF from the student guide.
- Add teacher notes or a separate answer guide if requested.
- Add built-in example structures without restoring the removed starter-frame button.
- Improve iPad touch-target spacing after device testing.
- Add a concise explanation of member failure directly beside the live failure measurement.
- Review the simplified material/failure calibration against the intended classroom learning outcomes, especially for very large payloads.

## Latest completed requests

1. Explained that a red member with `!` has failed and stops carrying load.
2. Changed the Guide from a pop-up window to a new browser tab.
3. Added the failed-member explanation to the student guide.
4. Removed the workbook section **How real buildings resist earthquakes**.
5. Converted the workbook fully from a team task to an individual task.
6. Regenerated and visually verified the 15-page Word and PDF workbook.

