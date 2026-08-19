# Speed of Sound Practical — Project Resume

## Purpose

This is a standalone vanilla HTML, CSS, and JavaScript classroom practical. Students record a sharp sound and its reflection from the sealed end of a tube, measure the time interval with two cursors, and calculate the speed of sound.

The project is designed to work offline after being copied to another machine. It has no build step, package manager, CDN, analytics, hosted font, external API, or third-party runtime dependency.

## Current files

### Runtime files

- `index.html` — main practical interface
- `physics.html` — student physics resource, opened from the practical in a new tab
- `styles.css` — shared responsive light/dark styling
- `app.js` — recording, waveform, cursor, crop, zoom, scrollbar, device, and results logic
- `math.js` — dependency-free calculation helpers
- `recorder-worklet.js` — sample-counted AudioWorklet recorder
- `assets/tube-microphone-setup.png` — local apparatus diagram

### Development and documentation files

- `tests.js` — deterministic calculation tests for Node-compatible environments
- `tests.html` — browser version of the deterministic tests
- `README.md` — run and test instructions
- `PROJECT_RESUME.md` — project handoff and continuation notes

The original `33 Speed of Sound.doc` source document was deliberately deleted during project cleanup. It is no longer present in this folder.

## Implemented features

### Recording

- Requests microphone permission only when needed.
- Lists built-in and USB audio inputs after permission is granted.
- Allows the student to choose the recording device.
- Disables echo cancellation, noise suppression, and automatic gain control where supported.
- Shows a three-second countdown.
- Records exactly `actual sample rate × 2 seconds` samples.
- Requests a 96 kHz AudioContext and reports the rate actually obtained.
- Uses `AudioWorklet` with a `ScriptProcessorNode` fallback.
- Stops microphone tracks and closes audio resources after capture and on page exit.

### Waveform analysis

- Responsive high-DPI canvas.
- Per-pixel minimum/maximum envelope preserves short impulses when zoomed out.
- Display-sensitivity slider changes visual gain only, never the recorded samples.
- Zoom In, Zoom Out, and Fit controls.
- Horizontal proportional scrollbar replaces the previous Pan mode.
- Scrollbar supports mouse, touch, stylus, Arrow keys, Page Up/Down, Home, and End.
- Non-destructive crop selection, Apply Crop, Undo Crop, and Show Full.
- Two draggable measurement cursors with mouse, touch, stylus, and keyboard control.
- Cursor positions and timing remain sample-based through zooming, scrolling, cropping, theme changes, and resizing.
- Waveform canvas was increased by approximately 76 CSS pixels (about 2 cm) for easier viewing.

### Measurements and results

- Live `t1`, `t2`, `Δt`, sample rate, and time-per-sample readouts.
- Live speed calculation beside the cursor readouts.
- Five trial rows support Save/Replace and Clear.
- New recordings preserve saved trial times.
- Calculates average echo time, experimental speed, accepted speed, and percentage difference.
- Confirmed Reset Experiment clears capture, inputs, trials, cursors, crop state, and display settings.

### Experiment inputs

- Tube length in metres.
- Room temperature in degrees Celsius.
- Optional internal tube diameter in millimetres.
- Optional microphone offset in millimetres.
- Selectable audio input device.

### Presentation

- Minimalist responsive design based on the existing Paul Gavini practical resources.
- Light and dark modes, with the preference stored in `localStorage`.
- Accessible focus states, status announcements, labels, and touch targets.
- The teacher reflection/question section was intentionally removed; teachers provide their own instructions.

## Physics and calculation decisions

### Echo speed

For a microphone and click together at an axial offset `x` outside a sealed tube of internal length `L`:

```text
round-trip distance = 2(L + x)
speed = 2(L + x) / Δt
```

If the click is produced at the tube-mouth plane and the microphone is outside it, the microphone path cancels from the direct-to-echo interval. In that arrangement, leave the offset at zero.

### Accepted speed

```text
accepted speed = 331.5 + 0.607T
```

`T` is in degrees Celsius and speed is in metres per second.

### Tube diameter

Diameter does not modify the closed-end travel distance. It is used to estimate the first transverse-mode cutoff:

```text
cutoff frequency = 1.84v / (πD)
```

`D` is the internal diameter in metres. The accepted temperature-dependent speed is used when available; otherwise the app uses 343 m/s for the estimate.

Above the cutoff, higher-order modes may broaden or split a broadband pulse. The app presents this as a measurement-quality warning rather than applying an unsupported diameter correction.

### End correction

No open-end correction is applied. This experiment measures a travelling pulse reflected from a sealed end, not an open-tube resonance.

### Trial calculations

Trial rows store echo times, not calculated speeds. Speeds are recalculated from the current tube length and microphone offset so the live readout, trial rows, and summary remain consistent.

## Important state in `app.js`

- `samples` — immutable full two-second `Float32Array`
- `sampleRate` — actual AudioContext rate
- `domainStart` / `domainEnd` — current non-destructive crop limits
- `viewStart` / `viewEnd` — currently visible zoom/scroll interval
- `cursorA` / `cursorB` — absolute sample indices
- `cropHistory` — reversible crop domains
- `trialTimes` — five saved echo intervals in seconds
- `displayGain` — waveform display multiplier only
- `mediaStream`, `audioContext`, and `audioNodes` — temporary capture resources

Do not convert cursor positions to canvas pixels for storage. Absolute sample indices are what preserve timing through display operations.

## Running locally

Microphone access requires HTTPS or localhost. From this folder:

```sh
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/index.html
```

Do not rely on opening `index.html` directly with a `file:` URL because browsers normally block microphone capture and AudioWorklet loading there.

## GitHub Pages deployment

Only the following runtime files need to be uploaded to the published GitHub Pages folder:

```text
index.html
physics.html
styles.css
app.js
math.js
recorder-worklet.js
assets/
└── tube-microphone-setup.png
```

Keep `index.html` at the root of the published folder and preserve the `assets/` directory name and structure. All runtime references are relative paths.

These files are useful in the working project but are not required in the GitHub Pages deployment:

```text
tests.html
tests.js
README.md
PROJECT_RESUME.md
```

GitHub Pages serves the application over HTTPS, which provides the secure context required for microphone permission. Microphone access still depends on the user's browser permission and device settings.

## Testing

### Deterministic tests

With Node installed:

```sh
node tests.js
```

Alternatively, serve the folder and open:

```text
http://localhost:8000/tests.html
```

### Manual acceptance checks

1. Grant and deny microphone permission and verify accessible status messages.
2. Find microphones, select a USB input, and confirm the selected device name appears after capture.
3. Record and verify the captured sample count equals `sampleRate × 2`.
4. Confirm the reported sample rate and time resolution match.
5. Move both cursors and check `Δt` and live speed update immediately.
6. Zoom and drag the horizontal scrollbar to both ends.
7. Test scrollbar Arrow, Page Up/Down, Home, and End keys.
8. Verify cursor times do not change through zoom, scrolling, resize, crop, undo, or theme changes.
9. Save, replace, and clear each trial.
10. Make another recording and verify saved trials remain.
11. Change tube length or microphone offset and confirm live/trial speeds recalculate consistently.
12. Enter a diameter and verify the cutoff readout changes with diameter and temperature.
13. Check light/dark mode on the practical and physics guide.
14. Test desktop Chrome/Edge/Safari and iPadOS Safari over HTTPS or localhost.
15. Disconnect or change an audio device and confirm the device list refreshes safely.

## Browser and hardware limitations

- A 96 kHz request is not a guarantee. The browser, operating system, audio interface, and microphone determine the actual rate.
- Some browsers ignore the microphone `sampleRate` constraint or resample internally.
- Safari and many built-in microphones commonly provide 44.1 or 48 kHz.
- Increasing a Web Audio context rate does not create information beyond the microphone hardware bandwidth.
- Permission and device labels behave differently across browsers; names may remain hidden until access is granted.
- The ScriptProcessor fallback is less robust than AudioWorklet but is retained for compatibility.

## Possible future enhancement: higher sample rates

If higher-rate capture is requested, prefer a safe fallback sequence rather than forcing one exact rate:

1. Try 192 kHz.
2. If unsupported, try 96 kHz.
3. If unsupported, use the device/browser default.
4. Always display the actual `audioContext.sampleRate`.

An optional `Automatic / 48 / 96 / 192 kHz` selector could be added, but `exact` constraints should not be the default because they can prevent recording on otherwise compatible devices.

## Constraints to preserve

- Keep the project vanilla and standalone.
- Do not add remote imports, CDN dependencies, analytics, or hosted assets.
- If a third-party library becomes genuinely necessary, store it under `vendor/` and document its name, version, source, licence, and purpose in `THIRD_PARTY_NOTICES.md`.
- Preserve the original samples when cropping or changing display sensitivity.
- Preserve saved trials when recording a new waveform.
- Keep microphone cleanup in every success, failure, and page-exit path.
- Keep the actual sample rate visible rather than claiming the requested rate was obtained.
- Keep the physics guide as student support; do not restore teacher-specific reflection questions unless explicitly requested.

## Last project state

At the time this resume file was last updated, the application syntax, deterministic physics calculations, HTML IDs, local asset references, and JavaScript DOM references had been checked successfully. The deployment set had been reduced to seven runtime files, including the image inside `assets/`. Full microphone behavior still requires testing with real browser permissions and hardware.
