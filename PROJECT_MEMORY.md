# Project Memory

## Project Overview
Static portfolio site for educational web apps and classroom tools.

## Current Architecture
The root `index.html` organizes links to standalone project folders by category. Each app is generally served from its own HTML, CSS, and JavaScript files.

## Current State
The homepage lists projects in Science, Math, Digital Technologies, and Teacher and student aides. The Science collection includes the duckweed photo measurement tool.

## Important Files
- `index.html`: Root project directory and category navigation.
- `styles.css`: Shared homepage styling.
- `duck_weed/index.html`: Duckweed photo measurement app entry point.

## Technical Decisions
Projects are linked directly from the homepage and remain independently organized in their folders.

## Dependencies and External Services
The homepage uses local CSS. Individual apps may have their own dependencies.

## Development and Deployment
The homepage and apps are static files. Build and deployment commands are not established in the repository guidance.

## Constraints and Conventions
Use relative links from the root homepage to project entry pages. Place each project in the homepage category that best matches its educational subject or purpose.

## Known Issues
None recorded.

## Active TODOs
None recorded.

## Recent Significant Changes
- Added the duckweed photo measurement tool to the Science collection on the homepage.
- Added creator attribution and YouTube, Website, and Help links to the duckweed app header.
