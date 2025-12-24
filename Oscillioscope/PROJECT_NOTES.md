# Oscilloscope Project Notes

Purpose
- Web-based oscilloscope that displays live microphone input using HTML/CSS/JS.
- Provides amplitude and time divisions, stable triggering, pause analysis, and measurement readouts.

How to Run
- Open the folder in a local web server (e.g., VS Code Live Server) so mic permissions work.
- Click "Start Audio" to request microphone access.

Core Features
- Live waveform rendering on a canvas with a grid and center line.
- V/div control via range input plus left/right arrow keys.
- Timebase control via discrete ms/div steps: 1, 2, 5, 10, 20, 40, 100.
- Positive edge trigger (rising zero-crossing) to stabilize the waveform.
- Pause button freezes the waveform for analysis.
- Cursor readout on pause: horizontal and vertical dashed lines with time/voltage at cursor.
- Frequency readout from autocorrelation estimate; period derived from frequency.
- Vpp (peak-to-peak) readout based on current V/div and waveform peak.

Files
- index.html
  - Layout for header, canvas, controls, labels, and tips.
  - Credits in top-right: "By Paul Gavini using CODEX, YouTube" with link.
- styles.css
  - Dark oscilloscope UI styling, grid container, labels, and controls.
  - Responsive layout for mobile.
- app.js
  - Microphone capture via getUserMedia with echoCancellation/noiseSuppression/autoGainControl disabled.
  - Analyzer with variable fftSize to match timebase window.
  - Triggered window selection (positive edge at left).
  - Waveform draw loop, frequency estimation, Vpp calculation, and cursor overlay.
  - Keyboard control for V/div (left/right arrows).

Important Implementation Notes
- Timebase updates analyzer fftSize so larger ms/div shows more data.
- Trigger uses rising zero-crossing in the most recent data window.
- Cursor values are computed from the canvas position relative to current time window and V/div.
- Frequency estimation uses autocorrelation on the displayed window with DC removal and sensible bounds.
- V/div display shows 3 decimal places; range is 0.005 to 1.5 V/div.

Usage Tips
- Use Pause to freeze the waveform; move the mouse over the canvas for cursor readings.
- Adjust V/div with the left/right arrows for fine control.
- If no waveform appears, ensure mic permissions and check system mic levels.

Known Constraints
- Browser mic permissions require https or localhost.
- OS-level mic enhancements can affect signal accuracy; disable in system settings if needed.

Requested/Removed Features
- Iterative smoothing removed by request.
- AGC removed by request; manual V/div control only.
