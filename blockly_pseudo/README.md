# blockly_pseudo

`blockly_pseudo` is a static browser app that rebuilds the `pseudocode` project as a Blockly-based pseudocode editor.

## Current Product

- Plain `index.html`, `styles.css`, and `script.js` with no build step
- Local vendored Blockly runtime under `vendor/blockly`
- Custom Blockly blocks for SACE-style pseudocode structures
- Live pseudocode preview generated from a custom `PSEUDO` generator
- Local autosave and JSON save/load using the `blockly-pseudo` file wrapper
- Soft workspace validation that guides users toward a single top-level `Program` block

## Run The App

Open [`index.html`](./index.html) in a browser.

Main interface files:

- [`index.html`](./index.html)
- [`styles.css`](./styles.css)
- [`script.js`](./script.js)
- [`vendor/blockly`](./vendor/blockly)

Useful checks:

```powershell
node --check .\script.js
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-docs.ps1
```

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

## Documentation

- [Docs index](docs/README.md)
- [Project overview](docs/project-overview.md)
- [Architecture](docs/architecture.md)
- [Setup](docs/setup.md)
- [Project status](docs/PROJECT_STATUS.md)
- [Worklog](docs/WORKLOG.md)
- [Backlog](docs/BACKLOG.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/DECISIONS.md)
- [Known issues](docs/KNOWN_ISSUES.md)
- [Runbook](docs/RUNBOOK.md)
- [Release notes](docs/RELEASE_NOTES.md)
- [Test plan](docs/TEST_PLAN.md)
- [Risks](docs/RISKS.md)

## Docs Tracker

Start the continuous tracker from the project root:

```powershell
.\scripts\start-docs-tracker.cmd
```

Run a one-off sync:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-docs.ps1
```
