# blockly_html

`blockly_html` is a static browser app for building beginner HTML pages and CSS styles with Blockly.

## Current Product

- Plain `index.html`, `styles.css`, and `script.js` with no build step
- Local vendored Blockly runtime under `vendor/blockly`
- Custom Blockly blocks for beginner HTML page structure, graphics/media content, tag attributes, and starter CSS rules
- Generated HTML/CSS source preview plus a rendered live preview
- Draggable split bar between the workspace and the preview column
- Built-in `help.html` page linked from the header
- Local autosave and JSON save/load using the `blockly-html` file wrapper
- Soft workspace validation that guides users toward one root HTML document block

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
  "format": "blockly-html",
  "workspace": {}
}
```

Local autosave uses the key `blockly-html-autosave-v1`.

## Scope

The current block library focuses on Years 7-9 beginner HTML and CSS topics:

- page structure
- headings and paragraphs
- links, figures, responsive images, audio, video, and SVG graphics
- semantic sections and containers
- lists
- tables
- forms
- common attributes such as `id`, `class`, `title`, and selected tag-specific attributes
- beginner CSS selectors and common style properties using dropdown-led blocks

`canvas` drawing is intentionally not included yet because it depends on JavaScript authoring.

JavaScript/script-tag authoring is intentionally out of scope for this stage.

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

## License

This project is not open source. See [LICENSE.md](./LICENSE.md).

## Docs Tracker

Start the continuous tracker from the project root:

```powershell
.\scripts\start-docs-tracker.cmd
```

Run a one-off sync:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-docs.ps1
```
