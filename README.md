# Linear VS Code authentication provider

[![CI](https://github.com/taylorsegell/linearlens/actions/workflows/ci.yml/badge.svg)](https://github.com/taylorsegell/linearlens/actions/workflows/ci.yml)

[This extension](https://marketplace.visualstudio.com/items?itemName=linear.linear-connect) exposes an authentication provider to connect to the Linear API.

You won't usually install this extension directly — another VS Code extension pulls it in as a dependency.

## How to use

> **Note:** Linear Connect v2.0.0 requires VS Code 1.96.0 or later (Cursor builds on the same engine) and uses refresh tokens. Users upgrading from v1.x must sign in again once.

If you're building a VS Code extension and want to interact with the [Linear API](https://linear.app/developers):

### Include the Linear Connect extension

Add [linear-connect](https://marketplace.visualstudio.com/items?itemName=linear.linear-connect) to `extensionDependencies` in your `package.json`:

```json
"extensionDependencies": [
  "linear.linear-connect"
]
```

### Get or create a Linear API session

```typescript
import * as vscode from "vscode";
import { LinearClient } from "@linear/sdk";

const session = await vscode.authentication.getSession(
  "linear",
  ["read"],
  { createIfNone: true }
);

if (session) {
  const linearClient = new LinearClient({
    accessToken: session.accessToken,
  });

  console.log("Acquired a Linear API session", {
    account: session.account,
  });
}
```

See [Open issue in Linear](https://github.com/linear/linear-vscode-open-issue) for a working example extension.

---

## Development

**Agent / contributor context:** see [AGENTS.md](./AGENTS.md) (also [CLAUDE.md](./CLAUDE.md)).

### Setup

```bash
yarn install
yarn esbuild
```

### Commands

| Command | Purpose |
|---------|---------|
| `yarn test` | Run unit tests |
| `yarn typecheck` | TypeScript check |
| `yarn esbuild` | Build `dist/main.js` |
| `yarn esbuild-watch` | Rebuild on change |

### Run locally (VS Code or Cursor)

1. Open this repo in VS Code or Cursor.
2. Press **F5** (**Run Extension**) to open an Extension Development Host.
3. Sign in via **Accounts → Linear**, or run in the dev host Debug Console:

```javascript
await vscode.authentication.getSession("linear", ["read"], { createIfNone: true })
```

4. Log out with **Linear: Logout all Linear API sessions** from the command palette.

**Cursor:** OAuth uses `cursor://linear.linear-connect/callback`. Register that redirect URI on your Linear OAuth app if sign-in fails with a redirect mismatch.

### Publishing

Install the packaging tool:

```bash
npm i -g @vscode/vsce
```

Before release:

1. Bump the version in `package.json` (semver).
2. Add entries to `CHANGELOG.md`.

Build the VSIX:

```bash
yarn esbuild
vsce package
```

This produces `linear-connect-<version>.vsix` (e.g. `linear-connect-2.0.0.vsix`).

Publish from the [VS Code marketplace publisher dashboard](https://marketplace.visualstudio.com/manage/publishers/Linear).

## License

MIT — see [LICENSE](./LICENSE).
