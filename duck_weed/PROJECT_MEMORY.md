# Project Memory

## Project Overview
A static, browser based tool for estimating visible duckweed area and container coverage from a photo. It supports student practical work; students record the displayed results manually in Excel. Photo coverage is a growth proxy, not a direct measurement of photosynthesis.

## Current Architecture
Vanilla HTML, CSS, and JavaScript. `index.html` provides one photo measurement workspace, `styles.css` provides responsive styling, and `app.js` handles photo upload/camera capture, image analysis, and live calculations. There is no backend or persistent data storage.

## Current State
Users upload or capture one photo, adjust a circular region to fit the dish interior, enter the known inside diameter in millimetres, and tune an automatically suggested HSB colour mask. Students can rerun the automatic suggestion from the current photo and circle; it replaces slider values. The page shows thresholded duckweed area in cm², dish coverage percentage, and calculated dish area. A toggle controls the overlay. Image zoom buttons provide 50% to 400% of fit size and reset to Fit; while zoomed in, dragging outside the dish circle pans the photo. The layout stacks the photo and controls in portrait tablet sizes and uses larger touch targets. The linked `help.html` page explains the workflow and provides direct downloads for five practice photos. Source photos and results remain in the current page session only; there is no experiment list, history, save, export, or restore feature.

## Important Files
- `index.html` — single purpose photo measurement interface, zoom controls, and automatic threshold reset.
- `help.html` — user guide and links to the five sample photos for download.
- `styles.css` — responsive mobile/tablet styling and touch targets.
- `app.js` — circle ROI, HSB segmentation, calibration, zoom/pan, live results, and camera/upload workflow.
- `research/duckweed-imaging-practical.md` — practical method, evidence, calculations, and limitations.
- `sample_folder/` — illustrative duckweed sample photos without visible scale markers; not experimental observations.

## Technical Decisions
- Visible image area is presented as a growth proxy, not a direct photosynthesis measure.
- Spatial calibration uses the adjusted circular ROI's pixel diameter and the user's measured inside diameter; users do not draw a separate calibration line.
- Duckweed segmentation uses an automatically suggested HSB threshold that students can adjust, rerun from the current photo and circle, and inspect with an overlay toggle.
- For this HSB workflow, a matte neutral white or light-grey background is the practical starting recommendation; the literature includes both black- and white-background workflows, so students should keep their chosen background consistent and inspect the overlay.
- Image zoom is relative to the fit-to-view size; photo panning at increased zoom uses a drag outside the dish circle.
- Measurements and original photos are not stored. Students transfer results to their own spreadsheet.
- Image processing is implemented with browser APIs and canvas, without runtime libraries or a backend.

## Dependencies and External Services
- Google Fonts (DM Sans and Manrope), with system font fallbacks.
- No runtime JavaScript libraries or backend services.

## Development and Deployment
Open `index.html` in a current browser or serve it from localhost. Camera access requires HTTPS or localhost; image upload is the fallback. There is no build step or configured automated test suite.

## Constraints and Conventions
- Keep all measurement claims cautious: glare, reflections, lighting, camera angle, overlaps, and threshold choice affect estimates.
- Recommend a matte, uniform, neutral background and repeatable diffuse lighting; treat white/light grey as a starting point, not a universal optimum.
- The app scales source images to a maximum edge of 1600 pixels for interactive analysis.
- The user should check and correct the automatic circle fit and inspect the colour mask before transcribing results.
- The photo is processed locally in the browser and not persisted by the app.
- Keep controls usable with touch input on iPad; portrait tablets stack the photo above the measurement controls.

## Known Issues
- Automatic circle detection is a rough radial-edge estimate; users should inspect and correct it.
- Colour thresholding counts visible pixels only and can mistake reflections, dirt, algae, pale leaves, or background for duckweed.
- A dense mat can approach full coverage even while biomass continues to increase.
- No labeled validation set is available to establish segmentation accuracy across different cameras and conditions.
- Background colours have not been compared head-to-head for this app's transparent-dish setup.

## Active TODOs
- Compare matte neutral backgrounds and validate circle detection and segmentation against repeatable, labeled photos if a suitable image set becomes available.

## Recent Significant Changes
- Added a Help page with measurement instructions, limitations, and direct downloads for the five sample photos; linked it from the app header.
- Added the site creator attribution and YouTube, Website, and Help links to the top bar; Help opens the in-project guide.
- Simplified the project to a single photo measurement workspace for manual Excel recording; removed experiment management, saved readings, charts, growth rates, and data archives.
- Changed calibration to the dish's adjusted circular ROI plus known inside diameter, and retained adjustable HSB mask preview.
- Added fit-relative zoom controls, zoomed-photo panning, larger touch targets with an iPad portrait layout, a button to rerun automatic HSB threshold suggestions, and background guidance in the practical note.

