# AGENTS.md

Context for AI agents and contributors working on **linear-connect** — the official Linear OAuth authentication provider for VS Code-compatible editors (VS Code, Cursor, etc.).

## Rules

- **Never rename** the auth provider id (`linear`) or secrets storage key (`linear.auth`).
- **OAuth redirect URIs** are `${vscode.env.uriScheme}://linear.linear-connect/callback`. Both `vscode://` and `cursor://` must be registered on the Linear OAuth app for sign-in to work in each editor.
- **Minimize diffs** — dependent extensions call `vscode.authentication.getSession("linear", scopes)`; behavior must stay stable across releases unless semver-major.
- **Do not commit or push** unless the user explicitly asks.
- **Verify before finishing:** `yarn typecheck && yarn test && yarn esbuild`.

## Stack

| | |
|---|---|
| Language | TypeScript (strict) |
| Package manager | Yarn — see `yarn.lock` |
| VS Code API | See `package.json` → `engines.vscode` |
| Bundle | esbuild → `dist/main.js` (~16 KB) |
| Tests | Vitest — `src/test/` |

## Project structure

```
src/
  extension.ts                    # activate: register provider + logout command
  LinearAuthenticationProvider.ts # VS Code AuthenticationProvider
  oauth/
    linearOAuth.ts                # exchange, refresh, revoke, viewer GraphQL, applyTokenRefresh
    scopes.ts                     # scopesKey, scopesMatch
    sessionStorage.ts             # parseStoredSessions, serializeStoredSessions
    sessionChanged.ts             # sessionChanged (token rotation detection)
    types.ts                      # LinearTokenResponse, StoredLinearSession
  test/                           # unit tests (mocked global fetch)
dist/main.js                      # shipped entry point
assets/128x128.png                # marketplace icon
```

## Commands

| Command | Purpose |
|---------|---------|
| `yarn install` | Install dependencies |
| `yarn esbuild` | Build `dist/main.js` |
| `yarn esbuild-watch` | Rebuild on file change |
| `yarn typecheck` | TypeScript check (`tsc --noEmit`) |
| `yarn test` | Run all Vitest tests |
| `yarn test:watch` | Vitest watch mode |
| `yarn compile` | Alias for `yarn typecheck` |
| `npx @vscode/vsce package` | Build installable `.vsix` |

CI (`.github/workflows/ci.yml`) runs `yarn typecheck`, `yarn test`, and `yarn esbuild` on push/PR to `main`.

## Architecture

| Concern | Implementation |
|---------|----------------|
| OAuth flow | Browser authorize → URI handler callback → POST token → store in `context.secrets` |
| Stored shape | `refreshToken` + `expiresAt` kept in secrets; callers get `AuthenticationSession` with access token only |
| Token refresh | Auto-refresh when within 5 min of expiry (`REFRESH_BUFFER_MS` in `linearOAuth.ts`) |
| Scope filtering | `getSessions(scopes)` returns sessions whose stored scopes are a superset of requested |
| Logout | Revoke via `POST https://api.linear.app/oauth/revoke`, then delete local secrets |
| Testability | Pure HTTP/scope/storage logic in `src/oauth/*`; provider wires VS Code APIs |

Legacy v1 sessions without `refreshToken` fail validation and are cleared — users re-auth once after upgrading to v2.

## Local development

1. `yarn install && yarn esbuild`
2. Open repo in VS Code or Cursor (engine version in `package.json`).
3. Launch **Run Extension** (F5) — opens Extension Development Host with dev build.
4. Sign in:
   - **Accounts** menu → **Linear** → Sign in, or
   - Debug Console in dev host:
     ```javascript
     await vscode.authentication.getSession("linear", ["read"], { createIfNone: true })
     ```
5. Logout: **Linear: Logout all Linear API sessions** (command palette).

**Cursor:** expect `vscode.env.uriScheme === "cursor"`. Add `cursor://linear.linear-connect/callback` to the Linear OAuth app if redirect fails.

If F5 preLaunch fails, run `yarn esbuild` manually first.

## Contributing

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`).
2. Add or update tests in `src/test/` for changes under `src/oauth/`.
3. Run `yarn typecheck && yarn test && yarn esbuild`.
4. Update `CHANGELOG.md` for user-visible changes.
5. Open a PR — CI must pass.

**Release:** bump semver in `package.json`, update `CHANGELOG.md`, `yarn esbuild`, `vsce package`, publish from Linear publisher account.

## Boundaries

- Do not change provider id, secret key, or OAuth client credentials without an explicit PKCE migration task.
- Multi-account (`supportsMultipleAccounts`) and l10n are deferred — do not add unless requested.
- `docs/superpowers/plans/` is dev planning only; excluded from `.vsix` via `.vscodeignore`.
