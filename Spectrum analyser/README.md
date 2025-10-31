# Audio Spectrum Analyser (Web)

A simple, privacy-friendly spectrum analyser built with the Web Audio API. It captures audio from your microphone, computes an FFT in real‑time, and displays the spectrum with an interactive hover readout that shows the exact frequency and magnitude at the cursor.

## Features

- Real‑time spectrum from your microphone
- Hover anywhere to read frequency and level (dB)
- Adjustable FFT size (resolution vs. latency)
- Adjustable smoothing
- Optional log‑frequency scale
- Crisp, responsive canvas rendering (HiDPI aware)

## Run locally

Because microphone access requires a secure context, open this via localhost (recommended) rather than file://.

- Option 1 (Python):
  - Windows: `py -m http.server 8000`
  - macOS/Linux: `python3 -m http.server 8000`
  - Then visit: http://localhost:8000/

- Option 2 (VS Code):
  - Install the “Live Server” extension
  - Right‑click `index.html` → “Open with Live Server”

- Option 3 (Node):
  - `npx http-server -p 8000` and visit http://localhost:8000/

Grant microphone permissions when prompted.

## Files

- `index.html` — UI and controls
- `style.css` — layout and visual styles
- `app.js` — audio capture, FFT, rendering, hover logic

## Notes

- Frequency resolution is `sampleRate / fftSize` (per bin). Increase FFT size for finer frequency spacing at the cost of latency.
- The log scale anchor starts at ~20 Hz; frequencies below that will align near the left edge if present.
- This app runs entirely in your browser; no audio is uploaded.

