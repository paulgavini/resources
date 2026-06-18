# Project Memory

## Current Purpose

This project is a static browser-only audio transcription app built with:

- `index.html`
- `styles.css`
- `app.js`

It started as a WMA converter and has been adapted into a local audio transcriber.

## Current User Goal

Keep the project as plain HTML, JavaScript, and CSS. No Python backend, Node build step, or server-side transcription.

The app should:

1. Accept audio files from drag/drop or file picker.
2. Sort selected files from newest to oldest using the browser-exposed file date.
3. Normalize audio in-browser with FFmpeg WASM.
4. Transcribe with Whisper base English in-browser.
5. Put the transcript into an editable text box.
6. Include a heading for each transcript block with the file name and file date.
7. Allow copy and `.txt` download.

## Important Browser Limitation

Browsers do not expose the original file creation date through normal file input/drop APIs.

The app uses `File.lastModified` as the file date. This is the closest available browser-only date and is used for sorting and transcript headings.

## Accepted File Types

The app accepts files with these extensions:

- `.wma`
- `.mp3`
- `.wav`
- `.m4a`
- `.aac`
- `.ogg`
- `.flac`
- `.webm`
- `.mp4`

It also accepts files where the browser reports a MIME type beginning with `audio/`.

## Model

Current transcription models are selectable in the UI. Only English-capable browser models are shown because the user only needs English transcription.

Browser-supported model options:

- `Xenova/whisper-tiny.en`
- `Xenova/whisper-base.en`
- `Xenova/whisper-small.en`
- `Xenova/whisper-medium.en`
- `onnx-community/moonshine-tiny-ONNX`
- `onnx-community/moonshine-base-ONNX`

Models are loaded through:

- `@huggingface/transformers@3.5.1`

The selected model downloads on first use and then relies on normal browser caching.

## FFmpeg Setup

FFmpeg core and WASM still load from jsDelivr, using the ESM core build:

- `https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm`

The small `@ffmpeg/ffmpeg` ESM wrapper has been vendored locally under:

- `vendor/ffmpeg/`

Reason: Edge blocked FFmpeg's worker when it was created from jsDelivr while the app was served from localhost. Serving the wrapper and `worker.js` locally keeps the Worker same-origin. The ESM core URL is required because the local FFmpeg worker is a module worker; passing the UMD core produces `Error: failed to import ffmpeg-core.js`.

## Key Files

- `index.html`: App layout, upload controls, model/runtime status, queue, transcript textarea.
- `app.js`: File queue, sorting, FFmpeg normalization, Whisper loading/transcription, transcript heading/copy/download behavior.
- `styles.css`: UI styling, queue states, runtime indicators, transcript editor.
- `vendor/ffmpeg/`: Local FFmpeg wrapper files required for same-origin worker loading.

## Run Locally

From the project root:

```bash
python3 -m http.server 3000
```

Then open:

```text
http://127.0.0.1:3000
```

If Edge still shows an old worker/CDN error, hard refresh with `Ctrl+F5` or clear site data for `127.0.0.1:3000`.

## Recent Implementation Notes

- The old MP3/WAV conversion UI has been removed.
- The transcript queue sorts newest to oldest before display/transcription.
- Queue items can be removed before transcription starts using the per-file Remove button. Removal is disabled while transcription is running.
- Transcript headings are generated as:

```text
file-name.ext - 18 Jun 2026, 8:42 am
====================================
Transcript text...
```

- For multiple files, transcript blocks are appended in sorted order.
- For a single file, the heading is still included.
- The transcription pipeline decodes the normalized WAV into raw mono PCM samples before passing it to Whisper. This is more reliable than passing a Blob URL directly.
- Empty model output is treated as an error: `The selected model returned no text for this file.`

## Known Gaps

- Full transcription smoke testing has not been completed in this environment because no sample audio file was present and the in-app browser was unavailable.
- `node` is not installed in the shell, so JavaScript syntax checking with `node --check` was not available.
- Large files may be slow or memory-heavy because both FFmpeg and Whisper run fully in the browser.
- Current working model choices are English-only Whisper models plus Moonshine tiny/base.
