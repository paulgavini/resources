# Agent Loom — Project Handoff

Use this file to resume development in a future session.

## Product goal

Agent Loom is a dependency-free visual editor for creating reusable AI agent prompts. A user builds a directed flow diagram from typed blocks, edits each block, and exports the result as clean Markdown that can be attached to or pasted into a chat.

The application must remain vanilla HTML, CSS, and JavaScript unless the user explicitly changes that requirement.

## Start here

The app has no build step or package dependencies. Open `index.html` directly in a browser or serve this directory with any static web server.

Primary files:

- `index.html` — application structure and controls
- `styles.css` — complete visual system, responsive layout, nodes, ports, and resizable panel
- `app.js` — state, templates, diagram interaction, persistence, import/export, and Markdown generation
- `README.md` — short user-facing feature summary

## Current capabilities

- Add and edit Goal, Input, Plan, Instruction, Decision, Tool, Resource, and Output blocks.
- Drag blocks around a pannable and zoomable canvas.
- Connect blocks by selecting a source output dot and then a destination input dot.
- Decision blocks have separate green `T` and coral `F` connectors.
- Decision labels are editable without losing their underlying true/false identity.
- Clicking an existing arrow removes that connection.
- Arrows begin and end just outside their port dots and are vertically centred.
- The canvas supports zoom, fit, clear, keyboard selection, and keyboard deletion.
- Diagram state is automatically saved in browser local storage.
- The vertical divider between the canvas and details panel is draggable, keyboard-adjustable, double-click resettable, and locally persisted.
- The Agent Preview updates live.
- Prompt Markdown can be copied or downloaded.
- Editable projects can be saved separately and reopened.

## File safety model

Two file formats intentionally serve different purposes:

1. `*.agentloom` is a formatted JSON project file containing the editable diagram, block coordinates, edges, URLs, and other project state.
2. `*.md` is a clean human-readable prompt for a chat. It contains no Base64 project data and no hidden `<!-- ... -->` metadata.

The Open Project control accepts current `.agentloom`/JSON files. It also contains a compatibility reader for older Agent Loom Markdown files that included hidden `agent-loom` metadata. New prompt exports never produce that metadata.

## Block data model

Each node contains approximately:

```js
{
  id: "unique_id",
  kind: "goal | input | plan | instruction | decision | tool | resource | output",
  x: 100,
  y: 100,
  title: "Block title",
  content: "Block instructions",
  url: "https://example.org",
  yesLabel: "True",
  noLabel: "False"
}
```

Each edge contains:

```js
{
  from: "source_node_id",
  to: "target_node_id",
  label: "Good enough",
  branch: "true | false | empty"
}
```

Imported state is constrained and normalised by `normalizeState()` before use.

## Generated Markdown structure

`generateMarkdown()` produces these sections when relevant:

1. YAML frontmatter
2. Purpose
3. Goal
4. Inputs
5. Plan
6. Resources
7. Tools
8. Flow map
9. Workflow
10. Expected output
11. Operating rules

The Flow map is the canonical compact representation of the complete diagram. It lists every connection, renders decision labels as `—[label]→`, and marks backward connections as `(loop)`.

Resource relationships are deliberately explicit:

- Each Resource says `Used by: ...`.
- Destination steps say `Receives from: ...`.
- Steps fed by Resources additionally say `Required resources: ...`.
- Ordinary outgoing connections say `Next: ...`.
- Decisions use a `Branches:` list.

## Built-in examples

### Rubric marking assistant

Receives a rubric and student work, assesses evidence, drafts a reporting comment, and checks that the result is supported, suitable for reporting, and 100–150 words. The True path returns the comment. The False path revises it and loops back to the readiness check.

### Tutorial notes generator

Defines a goal, plans a learning sequence, uses preferred resources, researches and drafts notes, self-assesses them, and decides whether they are good enough. The True path delivers the notes. The False path identifies gaps and loops back to Research and Verify.

The example constructors are `markingExample()` and `tutorialExample()` in `app.js`.

## Important implementation details

- `kindInfo` is the source of defaults and colours for block types.
- `orderedNodes()` provides a stable workflow order and retains nodes involved in cycles.
- Loop labels in the Flow map are inferred when an edge points back to an earlier node in that generated order.
- Decision branch identity is stored in `edge.branch`; do not infer new branches solely from a user-editable label.
- A Decision permits one destination per true/false port. Reconnecting a branch replaces only that branch.
- Regular blocks may have multiple outgoing connections.
- Resource blocks store references only. The app does not fetch website content.
- The canvas coordinate space is 2300 × 1200 pixels.
- Local storage keys are `agent-loom-project-v1` and `agent-loom-details-width`.

## Verification

Node.js is not available in the current environment. JavaScript has been checked by initialising `app.js` with a lightweight DOM stub through macOS JavaScriptCore:

```text
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
```

Completed checks include:

- JavaScript initialisation and live Markdown generation
- clean exports containing no hidden HTML comments
- project open/save controls and formats
- true/false branch rendering and export
- centred arrow geometry
- three Resources converging on one Tool
- complete Flow map output and loop labelling
- both built-in examples
- Goal and Plan sections
- persistent mouse and keyboard panel resizing
- unique HTML IDs, referenced assets, and balanced CSS braces

When changing export logic, test the full Tutorial Notes example because it covers goals, plans, resources, a tool, decision branches, and a feedback loop.

## Current constraints and likely next improvements

- There is no undo/redo history.
- Project state is local to one browser unless saved as `.agentloom`.
- Website resources are references; browsing depends on the AI environment receiving the exported prompt.
- The app has not been configured for remote hosting.
- Browser visual regression testing is not currently automated.
- Very large graphs may make the exported prompt verbose because connections appear in both the Flow map and detailed workflow.

Preserve the clean separation between editable project data and exported prompt Markdown when adding future features.
