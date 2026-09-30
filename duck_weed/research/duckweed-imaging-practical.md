# Duckweed photo measurement: practical notes

## Purpose and measurement claim

This tool estimates the **visible duckweed surface area and fraction of a container covered** from an overhead colour photograph. Repeated coverage measurements can describe growth. They do not directly measure photosynthesis. A change in visible coverage or colour may be consistent with a change in growth or plant condition, but neither is a measurement of photosynthetic rate.

The OECD Lemna growth inhibition guideline uses frond number together with at least one additional response variable, such as total frond area, fresh weight, or dry weight. It calculates average specific growth rate from changes in the logarithm of a chosen variable over time. This app reports a single photo's visible area and coverage only; students can record dated results in Excel and calculate changes separately. The app is not an OECD-compliant toxicity test.

## Evidence for image-derived area

- A computer image-analysis method for *Lemna minor* compared image-derived frond area with fresh biomass and reported a strong relationship in its tested conditions (R² = 0.996). This supports area as a useful proxy in a calibrated setup, not a universal conversion to mass.
- A later automated imaging protocol segmented top-view duckweed images into binary masks and measured thallus pixel area over time. The authors describe image area as a proxy for accumulated biomass.
- Published photo setups use different backgrounds for different workflows: one *Lemna minor* method placed beakers against black and selected the blue channel for contrast; a separate study photographed detached duckweed leaves on a white ceramic plate. These are not a head-to-head background comparison, so neither establishes a universal best colour for a clear circular dish.
- The Aquarium workflow is a practical analogue for consumer photos: it assumes a single circular vessel on a uniform background and derives area from counted green pixels plus the known dish diameter.
- ImageJ provides useful interaction precedents: a region of interest constrains measurement, and Color Threshold can classify images in HSB, RGB, CIE Lab, or YUV components while showing the threshold mask.

## Repeatable photo setup and workflow

1. Use the same circular container and photograph it from directly overhead. Keep the complete inside rim in frame and avoid oblique perspective.
2. Measure the dish's inside diameter in millimetres. In the app, fit the adjustable circular boundary to the inside rim and enter that known diameter. No scale marker or separately drawn calibration line is required because the circle's pixel diameter supplies the pixel scale.
3. For this app's HSB colour mask, start with a matte neutral white or light-grey surface beneath a clear dish. Neutral backgrounds have low saturation, so they are less likely to match a green-pixel threshold, and a uniform surface makes the image easier to compare. This is a practical starting point, not a proven universal optimum: published duckweed imaging has used both black and white setups with different analysis methods. Check the overlay on the actual setup, choose one background, and keep it unchanged across photos. Avoid glossy or patterned surfaces, green backgrounds, glare, shadows across the dish, reflections, condensation, and automatic exposure changes where possible.
4. Photograph at a consistent interval. Record the date, time, and displayed results in a student spreadsheet. Note changes in light, temperature, water, or handling when these may explain a growth change.
5. Inspect and correct the dish circle. The **Auto-suggest** button can rerun the automatic HSB estimate from the current photo and circle; it replaces the current slider values. Inspect the overlay and adjust the thresholds to include visible duckweed while excluding reflections and background pixels. Hide the mask to compare it with the original photo.
6. Use the zoom controls to magnify the image when needed (50–400% of Fit); while zoomed in, drag outside the dish circle to pan the photo.
7. Enter the known inside diameter and transcribe visible duckweed area, coverage, and dish area from the results into Excel. The app does not save photos or measurements.

## Image calculation

Let `r` be the adjusted circle radius in pixels, `D` the known inside diameter in millimetres, `N` the pixels classified as duckweed inside the circle, and `C` the pixels inside the circle.

- Calibration: `mmPerPixel = D / (2 × r)`.
- Estimated interior container area in cm²: `π × (D / 20)²`.
- Estimated visible duckweed area in cm²: `N × mmPerPixel² / 100`.
- Visible coverage percentage: `100 × N / C`.
- For manual spreadsheet analysis between positive-area readings, specific growth rate may be calculated as `μ = ln(A₂ / A₁) / elapsedDays`, in day⁻¹. Dates and area values need to be entered into the spreadsheet; the app does not calculate this rate.

These calculations assume a near top-down view, a flat image plane, a circle adjusted to the correct inner rim, and sufficiently consistent colour and lighting for the threshold to remain meaningful. Circular calibration does not correct perspective distortion.

## Provided sample images

The five 1254 × 1254 PNGs in `sample_folder/` show a range from sparse to dense surface coverage, but no physical scale marker is visible. They can be used to explore the mask and circle adjustment if the dish inside diameter is known. They are illustrative images rather than experimental observations; do not treat their derived percentages as biological results or as a validated accuracy benchmark.

## Interpretation limits and quality checks

- Colour thresholding counts visible pixels, not hidden or overlapping fronds. A crowded mat may approach full coverage while biomass continues to increase.
- Duckweed may clump or drift between photos. Specular highlights, dirt, algae, pale leaves, coloured containers, and background reflections can be mistaken for or hide plant pixels.
- A phone camera's white balance, exposure, lens angle, distance, and image processing can change apparent colour and geometry. Use a repeatable setup and inspect the threshold preview.
- Automatic circle detection is approximate. Check the complete inside rim and correct the circle before interpreting area.
- For formal experiments, count fronds and consider a direct biomass measure as an independent check. Photosynthesis itself requires a physiological method, such as chlorophyll fluorescence or gas exchange, rather than ordinary RGB coverage.

## References

1. OECD. (2006). [Test No. 221: Lemna sp. Growth Inhibition Test](https://doi.org/10.1787/9789264016194-en). OECD Guidelines for the Testing of Chemicals.
2. Haffner, O. et al. (2020). [Lemna minor Bioassay Evaluation Using Computer Image Analysis](https://doi.org/10.3390/w12082207). *Water*, 12(8), 2207.
3. Cox, K. L. et al. (2022). [Automated imaging of duckweed growth and development](https://doi.org/10.1002/pld3.439). *Plant Direct*.
4. [Open-source workflow design and management software to interrogate duckweed growth conditions and stress responses](https://pmc.ncbi.nlm.nih.gov/articles/PMC10472582/). Aquarium imaging and green-pixel area workflow.
5. ImageJ. [Color Threshold documentation](https://imagej.net/ij/docs/guide/146-28.html#toc-Subsection-28.2.5) and [Analyze > Set Scale / Measure documentation](https://imagej.net/ij/docs/menus/analyze).
6. McAusland, L. et al. (2024). [Physiological adaptation to irradiance in duckweeds is species and accession specific and depends on light habitat niche](https://pmc.ncbi.nlm.nih.gov/articles/PMC10967250/). Chlorophyll fluorescence provides photosynthesis-related physiological metrics.
7. Mazur, R. et al. (2018). [The use of computer image analysis in a Lemna minor L. bioassay](https://doi.org/10.1007/s10750-016-2972-7). Used a black background and blue-channel contrast in its controlled setup.
8. Nakagawa-Lagisz, T. & Lagisz, M. (2023). [Shining a light on duckweed: exploring the effects of artificial light at night (ALAN) on growth and pigmentation](https://doi.org/10.7717/peerj.16371). Used a white ceramic background for detached-leaf photos and area analysis.
