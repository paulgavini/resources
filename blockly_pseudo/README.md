# blockly_pseudo

`blockly_pseudo` is a static browser app that rebuilds the `pseudocode` project as a Blockly-based pseudocode editor.

## Current Snapshot

- Plain `index.html`, `styles.css`, and `script.js` with no build step
- Local vendored Blockly runtime under `vendor/blockly`
- Local vendored Mermaid Tiny runtime under `vendor/mermaid`
- Custom Blockly blocks for SACE-style pseudocode structures
- Live pseudocode preview generated from a custom `PSEUDO` generator
- Live flow diagram preview generated locally with Mermaid Tiny
- Local autosave and JSON save/load using the `blockly-pseudo` file wrapper
- Soft workspace validation that guides users toward a single top-level `Program` block

## Run The App

Open [`index.html`](./index.html) in a browser.

Main files in this workspace:

- [`index.html`](./index.html)
- [`styles.css`](./styles.css)
- [`script.js`](./script.js)
- [`vendor/blockly`](./vendor/blockly)
- [`vendor/mermaid`](./vendor/mermaid)

Quick check:

```powershell
node --check .\script.js
```

## GitHub Pages

This app is already a no-build static site, so it can be hosted directly on GitHub Pages.

Files added for Pages hosting:

- [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml)
- [`.nojekyll`](./.nojekyll)

Recommended publish steps:

1. Create a GitHub repository and upload the full project root.
2. Push to the `main` branch.
3. In GitHub, open `Settings -> Pages` and set `Source` to `GitHub Actions`.
4. Wait for the `Deploy GitHub Pages` workflow to finish.
5. Open the published HTTPS URL, usually `https://<username>.github.io/<repo>/`.

Why this matters for image copy:

- `Copy diagram image` is more reliable from an HTTPS site than from a local `file://` page.
- GitHub Pages gives the app a secure origin, which improves browser clipboard support.

## Save Format

Project files use this wrapper:

```json
{
  "version": 1,
  "format": "blockly-pseudo",
  "workspace": {}
}
```

Local autosave uses the key `blockly-pseudo-autosave-v1`.
