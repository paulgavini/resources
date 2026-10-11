# Project memory: Acid–Base Titration Simulator

## Project files

- `acid_base_titration_simulator_combined.html` is the current simulator. `help.html` links back to this file.
- `help.html` is the companion user guide. Keep its descriptions in sync with simulator features.
- `acid_base_titration_simulator.html` and `acid_base_titration_simulator_updated.html` are older variants. Treat the combined file as the working version unless the user asks otherwise.
- `lesson_sequence_board/` is a user-provided style reference. Its contents must not be changed.
- The project is a self-contained browser app: HTML, CSS, and JavaScript are embedded in the simulator file. No build step or package installation is required.

## Current behavior and features

- Supports acid-in-flask/base-titrant and base-in-flask/acid-titrant experiments.
- Lets users select chemicals, concentrations, flask volume, indicator, and titrant step size; users can step, slide, or play through the titration.
- Draws a calculated pH curve on a canvas. The selected indicator color appears at the current point in the graph area. Universal indicator also gives the graph a pH-colored background.
- Shows equivalence volumes, chemical and pKa information, dominant species, curve region, and student checkpoints.
- Exports the full calculated curve to CSV from 0 mL through the graph’s maximum volume, including the selected setup, calculated pH, curve region, dominant species, indicator details, and predicted equivalence volumes. Export is independent of the current slider/play position and uses the selected step size.
- The default indicator is Universal indicator. Other choices include no indicator, litmus, methyl red, phenolphthalein, methyl orange, and bromothymol blue.
- Keep the compact, minimalist teal styling, tight spacing between interface zones, and header links to YouTube, the author’s website, and local help.

## Chemical choices in the current simulator

- Acids: hydrochloric acid, hydrobromic acid, nitric acid, acetic acid, lactic acid, hydrofluoric acid, oxalic acid, carbonic acid, phosphoric acid, and citric acid.
- Bases: sodium hydroxide, potassium hydroxide, lithium hydroxide, sodium carbonate, ammonia, methylamine, pyridine, ethylamine, and ethanolamine.
- All bases are intended to be selectable both as flask solutions and as titrants. When changing the mode-specific option lists, preserve weak-base titrants as well as strong hydroxides.
- Weak-base pKa values in the data represent the conjugate acid: NH₄⁺ for ammonia, methylammonium for methylamine, pyridinium for pyridine, ethylammonium for ethylamine, and protonated ethanolamine for ethanolamine.
- Keep each acid’s stepwise pKa values and each polyprotic chemical’s stoichiometric equivalents consistent across the chemical data and calculations.

## Model and teaching limitations

- The calculation is an ideal, concentration-based acid–base equilibrium model at 25 °C. Strong acids and soluble strong hydroxides are treated as fully dissociated; weak and polyprotic systems are handled with equilibrium charge balance.
- Carbonate uses the carbonic acid/bicarbonate/carbonate equilibria. The model does not include CO₂ exchange with air, activity corrections, or other non-ideal solution effects; carbonate results should be described as classroom trends.
- Indicator colors and universal indicator’s color sequence are visual approximations. Universal indicator is a broad pH scale, not a precise endpoint indicator. Help text should retain these qualifications.
- For weak bases, display the conjugate-acid pKa label and explain that their equivalence region can be less sharp than for strong hydroxide titrants.

## Editing guidance

- Make simulator behavior changes in `acid_base_titration_simulator_combined.html`, then update `help.html` wherever the user-facing instructions or model claims change.
- Preserve the existing chemical options, especially the added bases and universal indicator default, when modifying option rebuilding or mode switching.
- Keep chemistry claims academically supportable; cite reliable references in the app when adding data, and state assumptions where the ideal model has limitations.
- The project is currently plain HTML/CSS/JavaScript. Avoid introducing dependencies or a build system unless requested.
