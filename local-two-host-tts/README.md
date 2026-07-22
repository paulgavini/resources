# Local Two Host TTS

This is a local-only browser app for turning a two-speaker transcript into one spoken WAV file using Kokoro.js.

It is designed for personal classroom-resource preparation. The transcript text is processed locally in your browser and is not uploaded to a backend server or sent to an external transcript API. On first use, Kokoro.js and the Kokoro model files may download and cache in the browser.

## Open in VS Code

1. Open VS Code.
2. Choose **File > Open Folder**.
3. Select the `local-two-host-tts` folder.

## Run Locally

From the `local-two-host-tts` folder, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Recommended browser: Chrome or Edge. Safari may not work reliably with the browser-based WASM/WebGPU pieces used by Kokoro.js and ONNX Runtime Web.

## Transcript Format

Use one speaker label per line:

```text
Host 1: Today we are looking at chemical reactions.
Host 2: So, what actually makes a reaction happen?
Host 1: Particles need to collide with enough energy.
```

These labels are recognised:

- `Host 1:` and `Speaker 1:` become Speaker A.
- `Host 2:` and `Speaker 2:` become Speaker B.

Lines without a speaker label are added to the previous speaker turn.

Tone tags such as `(curious)`, `[thoughtful]`, `(laughs)`, `(serious)`, and `[pause]` are removed before text-to-speech. Pause tags add a longer silence after that turn.

Chemical formulas are normalised before text-to-speech so symbols are spoken as letters:

- `Ca` becomes `C A`
- `NaCl` becomes `N A C L`
- `CO2` becomes `C O two`
- `H2SO4` becomes `H two S O four`
- `CaCO3` becomes `C A C O three`

## Default Voices

The default voices are:

- Host 1 / Speaker A: `af_heart`
- Host 2 / Speaker B: `am_puck`

To change the defaults or edit the fallback voice list, open `kokoroClient.js` and update:

- `DEFAULT_SPEAKER_A_VOICE`
- `DEFAULT_SPEAKER_B_VOICE`
- `FALLBACK_ENGLISH_VOICES`

## Export

The app exports a single WAV file named:

```text
two-host-tts-output.wav
```

MP3 export is not included. WAV export is prioritised for stability and browser compatibility.

## Speech Speed

Use the **Speech speed (%)** setting to slow down or speed up generated speech.

- `100%` is normal speed.
- Values below `100%` are slower.
- Values above `100%` are faster.

## Stopping Generation

Use **Stop** while generating audio to stop after the current speaker turn. Partial audio is discarded and no WAV is exported.

## Limitations

- Long transcripts may take time depending on the computer.
- First model use may take longer while files download and cache.
- Kokoro.js model files are loaded from the CDN/Hugging Face model source used by the browser library.
- Safari may not work reliably.
