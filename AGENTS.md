# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` + Turborepo monorepo.

- `packages/midorable`: Core TypeScript engine and Vitest suites in `test/**`.
- `packages/platform-browser`: Browser-specific platform implementation for `@rutan/midorable`.
- `packages/platform-headless`: Node.js platform implementation for testing use.
- `apps/example`: Vite-based game apps that consume `@rutan/midorable`.
- `apps/particle-editor`: React + Vite tool app.
- `config`: Shared lint/TypeScript base config.

## Build, Test, and Development Commands

Run from repository root unless noted.

- `pnpm dev`: Starts all workspace `dev` tasks via Turbo.
- `pnpm build`: Builds all packages/apps (`turbo build`).
- `pnpm test`: Runs workspace tests.
- `pnpm lint`: Runs format/lint checks (`oxfmt --check` + turbo lint tasks).
- `pnpm format`: Applies formatting and lint fixes.
- `pnpm --filter @rutan/midorable test-watch`: Watch-mode tests for engine development.

## Coding Style & Naming Conventions

- TypeScript style is enforced by `oxfmt`/`oxlint`.
- Use 2-space indentation, single quotes, and max line length 120.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes/types, test files as `*.test.ts`.
- Prefix intentionally unused variables/args with `_` to satisfy lint rules.

## Testing Guidelines

- Framework: Vitest.
- Add or update tests with every engine behavior change (rendering, input, loader, display objects).
- Run `pnpm test` before opening a PR.
