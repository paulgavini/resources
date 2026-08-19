# Speed of Sound Web Practical

A standalone microphone-based classroom practical built with plain HTML, CSS, and JavaScript. Audio remains on the device and no network service or third-party package is used.

The recorder requests 96 kHz capture and reports the actual browser audio rate and time per sample. Devices that cannot provide 96 kHz fall back to their supported/default rate. The sensitivity slider applies display gain only, leaving the original samples and cursor timing unchanged.

The minimalist interface includes light and dark themes. The theme choice is stored locally in the browser and the canvas waveform palette changes with it. When zoomed, an accessible horizontal scrollbar replaces the earlier pan mode; its proportional thumb can be dragged with a pointer or touch and moved with arrow, Page Up/Down, Home, and End keys.

Students can use **Find microphones** to grant permission, list available built-in and USB audio inputs, and select the exact device used for subsequent recordings.

The experiment details include optional internal tube diameter and microphone offset. Diameter is used to display the first transverse-mode cutoff, `1.84c/(pi D)`, as a pulse-quality warning; it does not change the closed-end path length. When the click and microphone are beside one another, a measured axial microphone offset is included in the round-trip distance as `2(L + x)`. If the click is instead made at the tube-mouth plane, the offset should remain zero because it cancels from the measured direct-to-echo interval. No open-end correction is applied because this practical uses reflection from a sealed end.

## Run locally

Microphone permissions require a secure context. Serve this folder from `localhost` rather than opening `index.html` directly. For example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a current Chrome, Edge, or Safari browser.

## Test

Open `tests.html` through the same local server to run the deterministic browser tests. If Node is installed, the same calculation suite can also be run with its built-in assertion module:

```sh
node tests.js
```

For microphone and interaction checks, use the acceptance scenarios in the implementation plan: record a sharp click, move both cursors, zoom, pan, crop/undo, save five trials, and verify that a second recording preserves the results table.

## Files

- `index.html` — practical instructions and interface
- `physics.html` — standalone student guide to the pulse-echo physics, tube diameter, corrections, and uncertainty
- `styles.css` — responsive instrument-panel design
- `app.js` — audio capture, canvas interactions, crop/zoom, and experiment state
- `math.js` — dependency-free calculation helpers
- `recorder-worklet.js` — exact raw-sample recorder
- `assets/tube-microphone-setup.png` — local apparatus illustration
- `PROJECT_RESUME.md` — project handoff, architecture, physics decisions, tests, and continuation notes

No external APIs, CDNs, fonts, analytics, or hosted assets are required.
