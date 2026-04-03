# Pseudocode

`pseudocode` is a drag-and-drop HTML, CSS, and JavaScript app for building structured pseudocode from reusable syntax blocks. The project also includes professional project documentation and an auto-tracking loop for core status docs.

## Run The App

Open [`index.html`](./index.html) in a browser.

Main interface files:

- [`index.html`](./index.html)
- [`styles.css`](./styles.css)
- [`script.js`](./script.js)

Core interactions:

- Expand syntax headings in the left library
- Drag blocks into the ordered canvas
- Double-click blocks to edit their values
- Reorder blocks and nest them inside control structures
- Copy the generated pseudocode from the live preview

## Documentation

- [Docs index](./docs/README.md)
- [Research](./research.md)
- [Project overview](./docs/project-overview.md)
- [Architecture](./docs/architecture.md)
- [Setup](./docs/setup.md)
- [Project status](./docs/PROJECT_STATUS.md)
- [Worklog](./docs/WORKLOG.md)
- [Backlog](./docs/BACKLOG.md)
- [Roadmap](./docs/ROADMAP.md)
- [Decisions](./docs/DECISIONS.md)
- [Known issues](./docs/KNOWN_ISSUES.md)
- [Runbook](./docs/RUNBOOK.md)
- [Release notes](./docs/RELEASE_NOTES.md)
- [Test plan](./docs/TEST_PLAN.md)
- [Risks](./docs/RISKS.md)

## Docs Tracker

Start the continuous tracker from the project root:

```powershell
.\scripts\start-docs-tracker.cmd
```

Run a one-off sync:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-docs.ps1
```

## Current Scope

- Project scaffold only
- Documentation system ready
- Auto-managed status tracking ready
