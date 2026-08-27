# QuakeLab Student Guide

## Your engineering challenge

Design a structure, test it on the shake table, measure its response, identify weaknesses, and improve it. Keep earthquake settings unchanged when comparing two designs.

## 1. Build a foundation

1. Select **Floor Joint** or press `G`.
2. Tap twice to create two foundation joints. They automatically appear on the solid ground line.
3. Check for lime-green centres. These joints are fixed to the shake table.
4. Select **Joint** or press `J` and place movable joints above the foundations.

## 2. Connect the structure

1. Select **Beam** (`B`) or **Brace** (`R`).
2. Press on the first joint, drag to the second joint, and release.
3. Add vertical columns and horizontal beams.
4. Try diagonal bracing. Triangular arrangements usually resist sideways movement better than unbraced rectangles.

Beams must end on joints. Placing a joint visually over an existing beam does not split that member.

## 3. Select materials

Choose timber, steel, reinforced, or lightweight before drawing new members. Compare the displayed relative strength, stiffness, weight, damping, and cost.

Changing the selected material affects new members only. It does not change members already in the structure.

## 4. Add payload masses

1. Select **Mass** or press `M`.
2. Tap a joint or any position along a member.
3. Tap an existing mass to open the mass editor.
4. Adjust it in 100 kg steps, enter a value from 100–5,000 kg, or remove it.

A beam-mounted mass is distributed between the two endpoint joints. It does not create an extra hinge.

## 5. Add analysis sensors

1. Select **Sensors** or press `S`.
2. Tap up to four joints or positions along members.
3. Each sensor is labelled S1–S4 and appears in Live Measurements.
4. Select a sensor from the graph menu to display its response over time.
5. Use `×` on a sensor card to remove it.

Sensors measure signed horizontal displacement relative to the moving shake table. Positive values indicate rightward movement and negative values indicate leftward movement.

## 6. Configure the earthquake

Set:

- **Amplitude:** maximum table displacement.
- **Frequency:** cycles per second. Frequency has a squared effect on peak acceleration.
- **Duration:** test length.
- **Structural damping:** simplified energy loss in the model.

The displayed peak acceleration is calculated using `a = (2πf)²A` and reported relative to gravitational acceleration.

## 7. Run the test

1. Check the structure cost, member count, and total mass.
2. Select **Start test**.
3. Observe roof sway, relative storey drift, failures, acceleration, sensors, and the response graph.
4. Use **Pause**, **Resume**, or **Reset** if needed.

Loading colours are relative classroom indicators, not professional beam-stress calculations.

## 8. Interpret survival

The structure survives only when all four classroom limits are satisfied:

- Maximum roof sway ≤ 160 mm
- Maximum relative storey drift ≤ 80 mm
- Failed members ≤ 25%
- At least 65% of the original structure height remains

The results window identifies the reason when a structure does not survive.

## 9. Improve and retest

Close the results window to return to editable Design Mode. Consider changing:

- Bracing pattern
- Member material
- Structure width or height
- Payload position
- Payload mass
- Number and position of members

Retest with the same earthquake settings to make a fair comparison.

## Save and submit

- **Save design** downloads a portable JSON design file.
- **Load** opens a previously saved design.
- **Export results CSV** downloads the recorded graph data.

## Troubleshooting

- **The structure falls immediately:** check that columns connect to Floor Joints.
- **A loose joint falls:** connect it with members before testing.
- **A beam will not appear:** drag from one joint and release directly over another.
- **A mass cannot be edited:** select Mass, then tap its label.
- **A sensor shows zero:** confirm it is attached to a moving joint or member and the correct sensor is selected in the graph.
- **The design cannot be edited after testing:** close the results window to return to Design Mode.

QuakeLab is a simplified comparative educational model. It must not be used for professional structural design or safety decisions.
