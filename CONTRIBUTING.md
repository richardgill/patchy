# Contributing to Patchy
See [ARCHITECTURE.md](./ARCHITECTURE.md)

## Development Setup

1. Clone the repository:
   ```sh
   git clone https://github.com/richardgill/patchy.git
   cd patchy
   ```

2. Install dependencies:
   ```sh
   bun install
   ```

3. Run the CLI in development mode:
   ```sh
   bun run dev
   ```

   **Tip:** You can run the dev CLI from any directory using `--cwd`:
   ```sh
   bun run --cwd /path/to/patchy dev init
   ```

   **Tip:** Add a shell alias for quick access:
   ```sh
   alias patchydev='bun run --cwd /path/to/patchy dev'
   ```

## Development Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Run the CLI in development mode |
| `bun run build` | Build the TypeScript source |
| `bun run test` | Run the test suite |
| `bun run test-watch` | Run tests in watch mode |
| `bun run check` | Run linting and formatting checks |
| `bun run check-fix` | Fix linting and formatting issues |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run local-ci` | Run all CI checks locally (lint, typecheck, test) |
