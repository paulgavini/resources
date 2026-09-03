# Agent Loom

Agent Loom is a dependency-free visual builder for reusable Markdown agent prompts.

Open `index.html` directly, or serve this directory with any static web server. The project runs entirely in the browser and stores the current diagram in local storage.

## Features

- Add and drag goal, input, plan, instruction, decision, tool, resource, and output blocks
- Export Goal and Plan blocks into dedicated prompt sections
- Add website references with a URL and clear usage instructions
- Preserve connections explicitly in prompt exports with Used by, Receives from, Required resources, Next, and Branches fields
- Generate a complete Flow map with every connection, labelled decision path, and backward loop
- Resize the block editor and agent preview with a persistent, keyboard-accessible vertical divider
- Connect blocks by selecting an output dot and then an input dot
- Route Decision blocks through distinct True and False output connectors
- Edit block names and instructions with live Markdown generation
- Pan, zoom, fit, clear, and reset the canvas
- Copy or download a clean `.md` prompt with no hidden project metadata
- Save editable diagrams separately as `.agentloom` project files
- Open `.agentloom` project files, with migration support for earlier Agent Loom `.md` exports
- Load a rubric-marking example that produces a 100–150-word student report comment
- Load a tutorial-notes example that loops through self-assessment, gap analysis, and further research until it is good enough
