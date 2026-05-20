# Repository Guidelines

This is a Vite + TypeScript sample project for the Midorable browser game engine.

see README.md for the concept.

## Commands

- `pnpm dev`: Start the local Vite development server.
- `pnpm build`: Build the production version using Vite.
- `pnpm start`: Preview the production build locally.
- `pnpm format`: Auto-format code with `oxfmt` and apply `oxlint` fixes. (if you edit code, run this command)
- `pnpm lint`: Run all linters (`oxfmt`, `oxlint`, and `tsgo`. If you edit code, run this command).

## Directory Structure

- src/: Main source code for the Midorable engine and demo.
  - core/: Core engine modules (App, DisplayObjects, etc.). This directory is not dependent on any specific platform (ex. browser).
  - platforms/: Platform-specific implementations (Canvas, WebGPU, etc.).
  - demo.ts: Entry point for the demo application.

## Coding Style & Naming Conventions

Formatting and linting are enforced with `oxfmt` and `oxlint`.

- Use single quotes and a 120 character print width (see `.oxfmtrc.json`).
- Keep imports sorted by the configured oxfmt grouping.
- Prefer `camelCase` for variables/functions and `PascalCase` for classes/types.
- Ignore unused parameters by prefixing with `_` (per `.oxlintrc.json`).

Please keep the code simple and straightforward.
Avoid unnecessary abstractions or overly complex patterns. Focus on expressing the intent clearly and directly.
