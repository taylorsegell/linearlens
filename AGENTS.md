# AGENTS.md

Context for AI agents and contributors working on **Linear Lens** (`taylorsegell.linearlens`) — Linear sidebar + panels for VS Code-compatible editors (VS Code, Cursor, etc.).

## Rules

- **Never rename** the auth provider id (`linearlens`) or secrets storage key (`linear.auth`) without an explicit migration task.
- **OAuth** is deferred for a future release. Sidebar/panels use a Personal API key. When OAuth ships, redirect URIs will be `${vscode.env.uriScheme}://taylorsegell.linearlens/callback` and `OAUTH_CLIENT_ID` in `src/oauth/linearOAuth.ts` must match your Linear OAuth app.
- **Minimize diffs** for auth/storage behavior when changing OAuth internals.
- **Do not commit or push** unless the user explicitly asks.
- **Verify before finishing:** `yarn typecheck && yarn test && yarn build`.

## Stack

| | |
|---|---|
| Language | TypeScript (strict) |
| Package manager | Yarn — see `yarn.lock` |
| VS Code API | See `package.json` → `engines.vscode` |
| Bundle | esbuild → `dist/main.js`; Vite → `dist/webview/` |
| Tests | Vitest — `src/test/` |
| Marketplace | `taylorsegell.linearlens` |

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

1. `yarn install && yarn build`
2. Open repo in VS Code or Cursor (engine version in `package.json`).
3. Launch **Run Extension** (F5) — opens Extension Development Host with dev build.
4. Connect with **Linear: Set API Key** (OAuth Accounts sign-in is deferred for a later release).
5. Logout OAuth sessions (when configured): **Linear Lens: Logout all Linear API sessions**.

If F5 preLaunch fails, run `yarn build` manually first.

## Contributing

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`).
2. Add or update tests in `src/test/` for changes under `src/oauth/` or `src/linear/`.
3. Run `yarn typecheck && yarn test && yarn build`.
4. Update `CHANGELOG.md` for user-visible changes.
5. Open a PR — CI must pass.

**Release:** bump semver in `package.json`, update `CHANGELOG.md`, `yarn package` (runs `vscode:prepublish` = minify host + build webview), publish as `taylorsegell` from your Marketplace publisher account.

## Boundaries

- Do not change provider id (`linearlens`), secret key (`linear.auth`), or OAuth client credentials without an explicit migration task.
- OAuth Accounts flow is deferred until a Linear OAuth app is configured.
- Multi-account (`supportsMultipleAccounts`) and l10n are deferred — do not add unless requested.
- `docs/superpowers/plans/` is dev planning only; excluded from `.vsix` via `.vscodeignore`.
