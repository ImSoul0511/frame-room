# Install pnpm with npm, without Corepack

**Current repository setup.** FrameRoom requires Node `>=22.13.0 <23`, `pnpm@9.15.0`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `@frameroom/shared: workspace:*` dependencies (`package.json`, `apps/{web,api}/package.json`). Repository scripts and active instructions call pnpm directly. Developers install the pnpm CLI with npm; pnpm remains the monorepo dependency manager. The official pnpm guide supports [global installation through npm](https://pnpm.io/installation); npm documents [`npm install -g`](https://docs.npmjs.com/downloading-and-installing-packages-globally/) for global tools.

## Developer setup

Use a Node 22 version compatible with `package.json`. npm installs the CLI; pnpm installs the workspace dependencies:

```powershell
node --version
npm --version
npm install --global pnpm@9.15.0
pnpm --version
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Verify that `pnpm --version` reports `9.15.0` before installing dependencies. Do not use `pnpm@latest`: the current release line differs from the exact version in this repository's `packageManager` and `engines.pnpm`. `pnpm install --frozen-lockfile` preserves `pnpm-lock.yaml` as documented by [pnpm install](https://pnpm.io/cli/install). Replacing it with `npm install` or `npm ci` would change the project's dependency manager and require a separate workspace and lockfile migration. This repository uses pnpm's `workspace:*` protocol; the [npm CLI issue tracker](https://github.com/npm/cli/issues/8845) documents `EUNSUPPORTEDPROTOCOL` for that syntax.

On Windows, if `pnpm` still resolves to a Corepack shim or is absent after npm installation, inspect `Get-Command pnpm -All` and `where.exe pnpm.*`, then resolve the developer machine's `PATH` order. Do not automatically delete shims or overwrite system files. The [pnpm troubleshooting guide](https://pnpm.io/installation#troubleshooting) describes conflicting installations on `PATH`.

## Implementation status

| Source                                                              | Status                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `package.json`                                                 | Scripts call `pnpm` directly; `packageManager: pnpm@9.15.0`, engines, and lockfile remain pinned.                                                          |
| `.husky/pre-commit`, `.husky/commit-msg`                            | Hooks call `pnpm exec` directly.                                                                                                                           |
| `scripts/start-dev.bat`                                             | Checks for pnpm 9.15.0 and calls `pnpm dev`.                                                                                                               |
| `scripts/dev.mjs`                                                   | Uses the invoking CLI's `npm_execpath`; it contains no Corepack reference.                                                                                 |
| `README.md`, `docs/contributing.md`, agent guides and active skills | Describe npm installation of pinned pnpm and direct `pnpm` commands.                                                                                       |
| Old task verification reports and exercises                         | Retain past Corepack commands as historical evidence; they are not current instructions.                                                                   |
| Disabled CI reference                                               | `.github/workflows/ci.yml.disabled` now shows npm installation of pnpm 9.15.0 followed by `pnpm install --frozen-lockfile`; the workflow remains inactive. |

The repository change should be verified on a clean machine or runner with Node 22 and npm: install pnpm 9.15.0, confirm its version, then run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm dev`, and the Windows wrapper without Corepack. The lockfile should remain unchanged. The MVP feature branch still contains separate Corepack references in its own scripts; update and check its commands (`dev:worker`, `test:db`, `ai:index`, `ai:evaluate`) when that branch is transferred. Removing Corepack is independent of the Supabase Cloud decision; no local Supabase command is needed to verify pnpm.
