# Codex Project Instructions

## Project startup

At the beginning of every task:

1. Read `PROJECT_MEMORY.md` from the repository root before making changes.
2. If `PROJECT_MEMORY.md` does not exist, create it using the structure defined below.
3. Use the memory together with the current repository contents to understand the current state of the project.
4. Treat the actual repository contents as authoritative if they conflict with stale information in the memory file.
5. Update stale memory when such a conflict is discovered.

## Project understanding

Maintain concise project instructions here covering, where identifiable:

- project purpose
- architecture
- important directories and files
- entry points
- languages and frameworks
- important libraries and dependencies
- development commands
- build commands
- test commands
- deployment process
- coding conventions
- UI/design conventions
- data formats
- important architectural decisions
- constraints that should be preserved
- files or generated content that should not normally be modified

Keep `AGENTS.md` focused on instructions and relatively stable project conventions.

Do not turn it into a development diary.

## Persistent memory

Use `PROJECT_MEMORY.md` as the project's persistent working memory.

At the end of every task that materially changes the project, update `PROJECT_MEMORY.md`.

A material change includes:

- adding or removing a feature
- changing architecture
- modifying important behaviour
- changing a data structure or file format
- adding or removing a dependency
- changing build, test or deployment processes
- resolving a significant bug
- making an important design decision
- establishing a new project convention
- identifying an important limitation
- completing or changing a significant TODO

Do not update the memory for trivial formatting changes or inconsequential edits.

## Memory maintenance rules

When updating `PROJECT_MEMORY.md`:

- preserve useful existing information
- remove or replace information that is no longer true
- describe the current state rather than maintaining an ever-growing chronological transcript
- keep entries concise
- record decisions and the reasons for them when important
- record unresolved problems and significant TODOs
- do not duplicate information unnecessarily
- do not store large code blocks
- reference filenames, components or functions instead
- do not store secrets, passwords, API keys, tokens or other credentials
- keep the file useful enough that a new Codex session can understand the project without relying on previous chat history

Before finishing a task, silently determine whether the memory requires updating and update it when appropriate.

The user should not need to explicitly request a memory update.

## Instruction maintenance

If work on the project reveals a durable development rule or convention that future Codex sessions should always follow, update `AGENTS.md`.

Examples include:

- a particular file must not be modified
- a particular framework pattern must be followed
- a required test must be run after certain changes
- a persistent deployment constraint
- a project-wide coding convention

Put current project state in `PROJECT_MEMORY.md`.

Put permanent operating instructions in `AGENTS.md`.

Do not put temporary task details in `AGENTS.md`.

## `PROJECT_MEMORY.md` creation

If `PROJECT_MEMORY.md` does not exist, create it in the repository root using this structure:

# Project Memory

## Project Overview
A concise description of what the project currently does.

## Current Architecture
The important architecture, components, directories and relationships.

## Current State
The major functionality that currently exists and its status.

## Important Files
Important files and what they are responsible for.

## Technical Decisions
Significant technical or architectural decisions that should be preserved, including the reason when known.

## Dependencies and External Services
Important libraries, APIs, services or external systems used by the project.

## Development and Deployment
Relevant information about running, testing, building and deploying the project.

## Constraints and Conventions
Important technical, UI, data, compatibility or implementation constraints.

## Known Issues
Current significant bugs, limitations or technical debt.

## Active TODOs
Incomplete work that is important for future sessions to know about.

## Recent Significant Changes
A short rolling summary of significant recent changes.

Keep this section short. Remove older entries once they are adequately represented elsewhere in the memory.

Populate the initial memory from the repository as it exists at that time.

Do not guess. If information cannot be determined, omit it or clearly identify it as unknown.

## End-of-task checks

Before finishing any material task:

1. Confirm whether `PROJECT_MEMORY.md` needs to be updated.
2. Update it when appropriate.
3. Update `AGENTS.md` only if a durable project-wide instruction or convention has changed.
4. Ensure neither file contains credentials or secrets.
5. Ensure memory reflects the actual repository rather than stale assumptions.
