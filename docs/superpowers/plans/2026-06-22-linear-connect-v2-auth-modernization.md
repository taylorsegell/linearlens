# Linear Connect v2.0.0 Auth Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v2.0.0 of `linear-connect` with Linear's 2026 refresh-token OAuth model, scope-aware sessions, token revocation on logout, and a testable auth module — without changing the public provider id (`linear`) or breaking dependent extensions' `getSession("linear", scopes)` calls.

**Architecture:** Extract OAuth HTTP logic and scope/session helpers into pure TypeScript modules under `src/oauth/` that Vitest can test with mocked `fetch`. Keep VS Code wiring in `LinearAuthenticationProvider.ts`. Store extended session metadata (`refreshToken`, `expiresAt`) in `context.secrets` under the existing key `linear.auth`; return standard `vscode.AuthenticationSession` objects (access token only) to callers. Replace the `@linear/sdk` viewer lookup with a single GraphQL `fetch` to shrink bundle size as part of this release.

**Tech Stack:** TypeScript 5.x, Vitest, esbuild, VS Code Extension API (`^1.96.0`), native `fetch`, `crypto.randomUUID()`

## Global Constraints

- Provider id stays `"linear"` — do not rename.
- Secret storage key stays `"linear.auth"`.
- OAuth endpoints stay `https://linear.app/oauth/authorize`, `https://api.linear.app/oauth/token`, `https://api.linear.app/oauth/revoke`.
- Redirect URI stays `${vscode.env.uriScheme}://linear.linear-connect/callback`.
- Existing OAuth app client id/secret remain until PKCE migration (separate v2.1 plan).
- Access tokens expire in ~24h (`expires_in: 86399`); refresh when within 5 minutes of expiry.
- Old stored sessions without `refreshToken` are invalid — clear and require re-auth (document in CHANGELOG).
- Version bump to `2.0.0` on release.
- Engine floor: `"vscode": "^1.96.0"`.
- Do not add multi-account support in this plan (v2.2 follow-up).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/oauth/types.ts` | `LinearTokenResponse`, `StoredLinearSession`, type guards |
| `src/oauth/scopes.ts` | Scope key formatting, scope matching, non-mutating sort |
| `src/oauth/linearOAuth.ts` | Token exchange, refresh, revoke, viewer GraphQL fetch |
| `src/oauth/sessionStorage.ts` | Parse/validate/serialize secret storage JSON |
| `src/LinearAuthenticationProvider.ts` | VS Code `AuthenticationProvider` implementation |
| `src/extension.ts` | Activation, logout command (unchanged behavior) |
| `src/test/scopes.test.ts` | Unit tests for scope helpers |
| `src/test/linearOAuth.test.ts` | Unit tests for OAuth HTTP module |
| `src/test/sessionStorage.test.ts` | Unit tests for storage parse/validate |
| `vitest.config.ts` | Test runner config |
| `tsconfig.json` | Add `noEmit` typecheck path; exclude tests from esbuild bundle |
| `package.json` | Scripts, deps, manifest bump |
| `.github/workflows/ci.yml` | CI pipeline |
| `CHANGELOG.md` | v2.0.0 notes |
| `README.md` | Fix typos, update engine note |

---

### Task 1: Vitest test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: nothing
- Produces: `yarn test` script running Vitest; `yarn typecheck` via `tsc --noEmit`

- [ ] **Step 1: Add dev dependencies**

Modify `package.json` — add scripts and devDependencies:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p ./",
    "vscode:prepublish": "yarn esbuild-base --minify",
    "esbuild-base": "esbuild ./src/extension.ts --bundle --outfile=dist/main.js --external:vscode --format=cjs --platform=node",
    "esbuild": "yarn esbuild-base --sourcemap",
    "esbuild-watch": "yarn esbuild-base --sourcemap --watch",
    "compile": "yarn typecheck"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/vscode": "^1.96.0",
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Remove from `package.json` for this task (removed in Task 8 when provider is updated): `@types/node-fetch`, `@types/uuid`, `@linear/sdk`, `node-fetch`, `uuid` — **wait until Task 8** to avoid breaking build mid-plan. For Task 1, only add vitest/typescript bumps alongside existing deps.

Task 1 devDependency addition only:

```json
"devDependencies": {
  "@types/node": "^22.10.0",
  "@types/vscode": "^1.96.0",
  "esbuild": "^0.25.0",
  "typescript": "^5.7.0",
  "vitest": "^3.0.0"
}
```

Add scripts `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit -p ./"`.

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Update tsconfig for tests**

Modify `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "out"]
}
```

- [ ] **Step 4: Write smoke test**

Create `src/test/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `yarn install && yarn test`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json tsconfig.json src/test/smoke.test.ts yarn.lock
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 2: Scope helpers

**Files:**
- Create: `src/oauth/scopes.ts`
- Create: `src/test/scopes.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `scopesKey(scopes: readonly string[]): string` — sorted comma-joined key, does not mutate input
  - `scopesMatch(stored: readonly string[], requested: readonly string[]): boolean` — true when stored scopes are a superset of requested scopes

- [ ] **Step 1: Write failing tests**

Create `src/test/scopes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scopesKey, scopesMatch } from "../oauth/scopes";

describe("scopesKey", () => {
  it("sorts and joins scopes", () => {
    expect(scopesKey(["write", "read"])).toBe("read,write");
  });

  it("does not mutate the input array", () => {
    const input = ["write", "read"];
    scopesKey(input);
    expect(input).toEqual(["write", "read"]);
  });
});

describe("scopesMatch", () => {
  it("matches when stored scopes cover requested scopes", () => {
    expect(scopesMatch(["read", "write"], ["read"])).toBe(true);
  });

  it("rejects when stored scopes are insufficient", () => {
    expect(scopesMatch(["read"], ["read", "write"])).toBe(false);
  });

  it("matches identical scopes", () => {
    expect(scopesMatch(["read"], ["read"])).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/scopes.test.ts`
Expected: FAIL — cannot find module `../oauth/scopes`

- [ ] **Step 3: Implement scopes module**

Create `src/oauth/scopes.ts`:

```typescript
export function scopesKey(scopes: readonly string[]): string {
  return [...scopes].sort().join(",");
}

export function scopesMatch(
  stored: readonly string[],
  requested: readonly string[]
): boolean {
  const storedSet = new Set(stored);
  return requested.every((scope) => storedSet.has(scope));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/scopes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/oauth/scopes.ts src/test/scopes.test.ts
git commit -m "feat: add scope key and matching helpers"
```

---

### Task 3: OAuth types and session storage

**Files:**
- Create: `src/oauth/types.ts`
- Create: `src/oauth/sessionStorage.ts`
- Create: `src/test/sessionStorage.test.ts`

**Interfaces:**
- Consumes: `scopesKey` from `src/oauth/scopes.ts`
- Produces:
  - `StoredLinearSession` interface
  - `parseStoredSessions(json: string): Record<string, StoredLinearSession>`
  - `serializeStoredSessions(sessions: Record<string, StoredLinearSession>): string`
  - `isStoredLinearSession(value: unknown): value is StoredLinearSession`

- [ ] **Step 1: Write failing tests**

Create `src/test/sessionStorage.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  parseStoredSessions,
  serializeStoredSessions,
} from "../oauth/sessionStorage";

const validSession = {
  id: "session-1",
  accessToken: "access-abc",
  refreshToken: "refresh-xyz",
  expiresAt: Date.now() + 86_400_000,
  account: { id: "user-1", label: "Ada (ada@example.com)" },
  scopes: ["read"],
};

describe("parseStoredSessions", () => {
  it("parses valid stored sessions", () => {
    const raw = serializeStoredSessions({ read: validSession });
    const parsed = parseStoredSessions(raw);
    expect(parsed.read.accessToken).toBe("access-abc");
    expect(parsed.read.refreshToken).toBe("refresh-xyz");
  });

  it("throws on legacy session without refreshToken", () => {
    const legacy = {
      read: {
        id: "old",
        accessToken: "token",
        account: { id: "u", label: "User" },
        scopes: ["read"],
      },
    };
    expect(() => parseStoredSessions(JSON.stringify(legacy))).toThrow(
      /refreshToken/
    );
  });

  it("throws on corrupted JSON", () => {
    expect(() => parseStoredSessions("{not-json")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/sessionStorage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement types**

Create `src/oauth/types.ts`:

```typescript
import type * as vscode from "vscode";

export interface LinearTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
}

export interface StoredLinearSession extends vscode.AuthenticationSession {
  refreshToken: string;
  expiresAt: number;
}

export function isStoredLinearSession(
  value: unknown
): value is StoredLinearSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as StoredLinearSession;
  return (
    typeof session.id === "string" &&
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.expiresAt === "number" &&
    Array.isArray(session.scopes) &&
    session.scopes.every((scope) => typeof scope === "string") &&
    typeof session.account?.id === "string" &&
    typeof session.account?.label === "string"
  );
}
```

- [ ] **Step 4: Implement session storage**

Create `src/oauth/sessionStorage.ts`:

```typescript
import { isStoredLinearSession, StoredLinearSession } from "./types";

export function parseStoredSessions(
  json: string
): Record<string, StoredLinearSession> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid session storage JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid session storage shape");
  }

  const sessions = parsed as Record<string, unknown>;
  for (const [key, value] of Object.entries(sessions)) {
    if (!isStoredLinearSession(value)) {
      throw new Error(
        `Invalid stored session at key "${key}" — refreshToken required`
      );
    }
  }

  return sessions as Record<string, StoredLinearSession>;
}

export function serializeStoredSessions(
  sessions: Record<string, StoredLinearSession>
): string {
  return JSON.stringify(sessions);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/test/sessionStorage.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/oauth/types.ts src/oauth/sessionStorage.ts src/test/sessionStorage.test.ts
git commit -m "feat: add stored session types and secret storage parser"
```

---

### Task 4: Linear OAuth HTTP module

**Files:**
- Create: `src/oauth/linearOAuth.ts`
- Create: `src/test/linearOAuth.test.ts`

**Interfaces:**
- Consumes: `LinearTokenResponse` from `src/oauth/types.ts`
- Produces:
  - `exchangeCodeForToken(params): Promise<LinearTokenResponse>`
  - `refreshAccessToken(refreshToken: string): Promise<LinearTokenResponse>`
  - `revokeToken(token: string): Promise<void>`
  - `fetchViewer(accessToken: string): Promise<{ id: string; name: string; email: string }>`
  - `buildAuthorizeUrl(params): string`
  - Constants: `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_TOKEN_URL`, `OAUTH_REVOKE_URL`, `OAUTH_AUTHORIZE_URL`

- [ ] **Step 1: Write failing tests**

Create `src/test/linearOAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  exchangeCodeForToken,
  refreshAccessToken,
  revokeToken,
  fetchViewer,
  buildAuthorizeUrl,
} from "../oauth/linearOAuth";

describe("buildAuthorizeUrl", () => {
  it("joins scopes as comma-separated string", () => {
    const url = buildAuthorizeUrl({
      redirectUri: "vscode://linear.linear-connect/callback",
      scopes: ["read", "write"],
      state: "state-123",
    });
    expect(url).toContain("scope=read%2Cwrite");
    expect(url).toContain("state=state-123");
  });
});

describe("exchangeCodeForToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns token response on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 86399,
        token_type: "Bearer",
        scope: "read",
      }),
    });

    const result = await exchangeCodeForToken({
      code: "auth-code",
      redirectUri: "vscode://linear.linear-connect/callback",
    });

    expect(result.access_token).toBe("new-access");
    expect(result.refresh_token).toBe("new-refresh");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/oauth/token",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "invalid_grant" }),
    });

    await expect(
      exchangeCodeForToken({
        code: "bad",
        redirectUri: "vscode://linear.linear-connect/callback",
      })
    ).rejects.toThrow(/invalid_grant|Bad Request/);
  });
});

describe("refreshAccessToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends refresh_token grant", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 86399,
        token_type: "Bearer",
        scope: "read",
      }),
    });

    const result = await refreshAccessToken("old-refresh");
    expect(result.access_token).toBe("rotated-access");

    const [, init] = fetchMock.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
  });
});

describe("revokeToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("posts token to revoke endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await revokeToken("token-to-revoke");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/oauth/revoke",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("fetchViewer", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns viewer fields from GraphQL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          viewer: { id: "u1", name: "Ada", email: "ada@example.com" },
        },
      }),
    });

    const viewer = await fetchViewer("access-token");
    expect(viewer).toEqual({
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/linearOAuth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement linearOAuth module**

Create `src/oauth/linearOAuth.ts`:

```typescript
import { LinearTokenResponse } from "./types";

export const OAUTH_CLIENT_ID = "3117bb53c858872ff5cd4f9e0b3d0b5d";
export const OAUTH_CLIENT_SECRET = "2cafd5d87b5fab6937ea3e157504dbd3";
export const OAUTH_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
export const OAUTH_TOKEN_URL = "https://api.linear.app/oauth/token";
export const OAUTH_REVOKE_URL = "https://api.linear.app/oauth/revoke";

const TOKEN_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/x-www-form-urlencoded",
};

async function readTokenError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: string;
      error_description?: string;
    };
    if (json.error_description) {
      return json.error_description;
    }
    if (json.error) {
      return json.error;
    }
  } catch {
    // fall through
  }
  return response.statusText;
}

export function buildAuthorizeUrl(params: {
  redirectUri: string;
  scopes: readonly string[];
  state: string;
}): string {
  const searchParams = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scopes.join(","),
    state: params.state,
    prompt: "consent",
  });

  return `${OAUTH_AUTHORIZE_URL}?${searchParams.toString()}`;
}

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
}): Promise<LinearTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    grant_type: "authorization_code",
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body,
  });

  if (!response.ok) {
    throw new Error(await readTokenError(response));
  }

  return (await response.json()) as LinearTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<LinearTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body,
  });

  if (!response.ok) {
    throw new Error(await readTokenError(response));
  }

  return (await response.json()) as LinearTokenResponse;
}

export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });

  const response = await fetch(OAUTH_REVOKE_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body,
  });

  if (!response.ok && response.status !== 400) {
    throw new Error(await readTokenError(response));
  }
}

export async function fetchViewer(accessToken: string): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "{ viewer { id name email } }",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Linear viewer: ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: { viewer?: { id: string; name: string; email: string } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length || !json.data?.viewer) {
    throw new Error(
      json.errors?.[0]?.message ?? "Linear viewer missing from GraphQL response"
    );
  }

  return json.data.viewer;
}

export function tokenExpiresAt(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}

export const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function shouldRefreshToken(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - REFRESH_BUFFER_MS <= now;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/linearOAuth.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/oauth/linearOAuth.ts src/test/linearOAuth.test.ts
git commit -m "feat: add Linear OAuth HTTP module with tests"
```

---

### Task 5: Refactor LinearAuthenticationProvider

**Files:**
- Modify: `src/LinearAuthenticationProvider.ts` (full rewrite of OAuth/session logic)
- Modify: `package.json` (remove `@linear/sdk`, `node-fetch`, `uuid` and their types)

**Interfaces:**
- Consumes: all modules from Tasks 2–4
- Produces: Updated `LinearAuthenticationProvider` with:
  - `getSessions(scopes?: string[], options?: vscode.AuthenticationGetSessionOptions)`
  - Automatic token refresh before returning sessions
  - Revoke on `removeSession`
  - `buildAuthorizeUrl` for login (fixes scope URL bug)
  - `crypto.randomUUID()` instead of `uuid`

- [ ] **Step 1: Write provider integration test (session refresh path)**

Create `src/test/providerRefresh.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldRefreshToken,
  tokenExpiresAt,
  REFRESH_BUFFER_MS,
} from "../oauth/linearOAuth";

describe("shouldRefreshToken", () => {
  it("returns true when within refresh buffer", () => {
    const now = Date.now();
    const expiresAt = now + REFRESH_BUFFER_MS - 1_000;
    expect(shouldRefreshToken(expiresAt, now)).toBe(true);
  });

  it("returns false when token is fresh", () => {
    const now = Date.now();
    const expiresAt = tokenExpiresAt(86_399);
    expect(shouldRefreshToken(expiresAt, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (helpers already exist from Task 4)**

Run: `yarn test src/test/providerRefresh.test.ts`
Expected: PASS

- [ ] **Step 3: Rewrite LinearAuthenticationProvider**

Replace `src/LinearAuthenticationProvider.ts` with:

```typescript
import * as vscode from "vscode";
import { scopesKey, scopesMatch } from "./oauth/scopes";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchViewer,
  refreshAccessToken,
  revokeToken,
  shouldRefreshToken,
  tokenExpiresAt,
} from "./oauth/linearOAuth";
import {
  parseStoredSessions,
  serializeStoredSessions,
} from "./oauth/sessionStorage";
import { StoredLinearSession } from "./oauth/types";

const OAUTH_REDIRECT_URL = `${vscode.env.uriScheme}://linear.linear-connect/callback`;
const SECRET_STORAGE_KEY = "linear.auth";

type SessionMap = Record<string, StoredLinearSession>;

export class LinearAuthenticationProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  constructor(private readonly context: vscode.ExtensionContext) {
    this.sessionsPromise = this.getSessions();

    this.disposable = vscode.Disposable.from(
      vscode.window.registerUriHandler(this.uriEventHandler),
      vscode.authentication.registerAuthenticationProvider(
        "linear",
        "Linear",
        this,
        { supportsMultipleAccounts: false }
      ),
      this.context.secrets.onDidChange(() => this.checkForUpdates())
    );
  }

  public dispose() {
    this.disposable.dispose();
  }

  public get onDidChangeSessions() {
    return this.sessionChangeEmitter.event;
  }

  public async getSessions(
    scopes?: string[],
    _options?: vscode.AuthenticationGetSessionOptions
  ): Promise<vscode.AuthenticationSession[]> {
    const sessions = await this.loadAndRefreshSessions();
    if (!scopes || scopes.length === 0) {
      return sessions.map(toAuthenticationSession);
    }

    return sessions
      .filter((session) => scopesMatch(session.scopes, scopes))
      .map(toAuthenticationSession);
  }

  public async createSession(
    scopes: string[]
  ): Promise<vscode.AuthenticationSession> {
    const existingSession = await this.retrieveSession(scopes);
    if (existingSession) {
      const refreshed = await this.refreshSessionIfNeeded(existingSession);
      return toAuthenticationSession(refreshed);
    }

    const tokens = await this.login(scopes);
    const viewer = await fetchViewer(tokens.access_token);

    const session: StoredLinearSession = {
      id: crypto.randomUUID(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokenExpiresAt(tokens.expires_in),
      account: {
        label: `${viewer.name} (${viewer.email})`,
        id: viewer.id,
      },
      scopes: [...scopes],
    };

    await this.storeSession(scopes, session);

    this.sessionChangeEmitter.fire({
      added: [toAuthenticationSession(session)],
      removed: [],
      changed: [],
    });

    return toAuthenticationSession(session);
  }

  public async removeSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.readSessions();
      for (const [key, session] of Object.entries(sessions)) {
        if (session.id !== sessionId) {
          continue;
        }

        await revokeToken(session.accessToken).catch(() => undefined);
        await revokeToken(session.refreshToken).catch(() => undefined);

        const loggedOutSession = { ...session };
        delete sessions[key];
        await this.writeSessions(sessions);

        this.sessionChangeEmitter.fire({
          added: [],
          removed: [toAuthenticationSession(loggedOutSession)],
          changed: [],
        });
        return;
      }

      throw new LinearAuthenticationProviderError(
        `Session ${sessionId} not found`
      );
    } catch (error) {
      this.error(`Log out of Linear failed: ${error}`, {
        userPresentableMessage: "Logging out of Linear failed",
      });
      throw error;
    }
  }

  private async login(scopes: string[]) {
    const state = crypto.randomUUID();
    const authorizeUri = vscode.Uri.parse(
      buildAuthorizeUrl({
        redirectUri: OAUTH_REDIRECT_URL,
        scopes,
        state,
      })
    );

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Signing in to Linear...",
        cancellable: true,
      },
      async (_progress, token) => {
        await vscode.env.openExternal(authorizeUri);

        let subscription: vscode.Disposable | undefined;
        const codeExchangePromise = new Promise<Awaited<
          ReturnType<typeof exchangeCodeForToken>
        >>((resolve, reject) => {
          subscription = this.uriEventHandler.event((uri) => {
            void this.handleOAuthCallback(state, uri).then(resolve).catch(reject);
          });
          token.onCancellationRequested(() => {
            reject(new LinearAuthenticationProviderError("Cancelled"));
          });
        });

        try {
          return await Promise.race([
            codeExchangePromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new LinearAuthenticationProviderError("Timed out")),
                60_000
              )
            ),
          ]);
        } finally {
          subscription?.dispose();
        }
      }
    );
  }

  private async handleOAuthCallback(state: string, uri: vscode.Uri) {
    const query = new URLSearchParams(uri.query);
    const code = query.get("code");
    const callbackState = query.get("state");

    if (!code) {
      throw new LinearAuthenticationProviderError("No authorization code");
    }

    if (state !== callbackState) {
      throw new LinearAuthenticationProviderError("OAuth state mismatch");
    }

    return exchangeCodeForToken({
      code,
      redirectUri: OAUTH_REDIRECT_URL,
    });
  }

  private async loadAndRefreshSessions(): Promise<StoredLinearSession[]> {
    const sessions = await this.readSessions();
    const refreshedSessions: StoredLinearSession[] = [];
    const changed: vscode.AuthenticationSession[] = [];
    let dirty = false;

    for (const [key, session] of Object.entries(sessions)) {
      const refreshed = await this.refreshSessionIfNeeded(session);
      refreshedSessions.push(refreshed);
      if (refreshed.accessToken !== session.accessToken) {
        sessions[key] = refreshed;
        dirty = true;
        changed.push(toAuthenticationSession(refreshed));
      }
    }

    if (dirty) {
      await this.writeSessions(sessions);
      if (changed.length) {
        this.sessionChangeEmitter.fire({ added: [], removed: [], changed });
      }
    }

    return refreshedSessions;
  }

  private async refreshSessionIfNeeded(
    session: StoredLinearSession
  ): Promise<StoredLinearSession> {
    if (!shouldRefreshToken(session.expiresAt)) {
      return session;
    }

    const tokens = await refreshAccessToken(session.refreshToken);
    return {
      ...session,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokenExpiresAt(tokens.expires_in),
    };
  }

  private async checkForUpdates() {
    const previousSessions = await this.sessionsPromise;
    this.sessionsPromise = this.getSessions();
    const storedSessions = await this.sessionsPromise;

    const added: vscode.AuthenticationSession[] = [];
    const removed: vscode.AuthenticationSession[] = [];

    for (const storedSession of storedSessions) {
      if (!previousSessions.find((s) => s.id === storedSession.id)) {
        added.push(storedSession);
      }
    }

    for (const previousSession of previousSessions) {
      if (!storedSessions.find((s) => s.id === previousSession.id)) {
        removed.push(previousSession);
      }
    }

    if (added.length || removed.length) {
      this.sessionChangeEmitter.fire({ added, removed, changed: [] });
    }
  }

  private async readSessions(): Promise<SessionMap> {
    const raw = await this.context.secrets.get(SECRET_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    try {
      return parseStoredSessions(raw);
    } catch (error) {
      console.error("Could not load valid data from secrets store", error);
      await this.context.secrets.delete(SECRET_STORAGE_KEY);
      return {};
    }
  }

  private async writeSessions(sessions: SessionMap): Promise<void> {
    this.sessionsPromise = Promise.resolve(
      Object.values(sessions).map(toAuthenticationSession)
    );
    await this.context.secrets.store(
      SECRET_STORAGE_KEY,
      serializeStoredSessions(sessions)
    );
  }

  private async storeSession(
    scopes: string[],
    session: StoredLinearSession
  ): Promise<void> {
    const sessions = await this.readSessions();
    sessions[scopesKey(scopes)] = session;
    await this.writeSessions(sessions);
  }

  private async retrieveSession(
    scopes: string[]
  ): Promise<StoredLinearSession | undefined> {
    const sessions = await this.readSessions();
    return sessions[scopesKey(scopes)];
  }

  private error(
    message: string,
    options?: { userPresentableMessage?: string }
  ) {
    console.error(message);
    vscode.window.showErrorMessage(options?.userPresentableMessage || message);
  }

  private sessionChangeEmitter =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private disposable: vscode.Disposable;
  private sessionsPromise: Promise<vscode.AuthenticationSession[]>;
  private uriEventHandler = new UriEventHandler();
}

function toAuthenticationSession(
  session: StoredLinearSession
): vscode.AuthenticationSession {
  return {
    id: session.id,
    accessToken: session.accessToken,
    account: session.account,
    scopes: session.scopes,
  };
}

class UriEventHandler
  extends vscode.EventEmitter<vscode.Uri>
  implements vscode.UriHandler
{
  public handleUri(uri: vscode.Uri) {
    this.fire(uri);
  }
}

export class LinearAuthenticationProviderError extends Error {}
```

- [ ] **Step 4: Remove obsolete dependencies from package.json**

Remove from `dependencies`:
- `@linear/sdk`
- `node-fetch`
- `uuid`

Remove from `devDependencies`:
- `@types/node-fetch`
- `@types/uuid`

- [ ] **Step 5: Run full test suite and typecheck**

Run: `yarn install && yarn test && yarn typecheck && yarn esbuild`
Expected: all PASS; `dist/main.js` significantly smaller than 1.2 MB

- [ ] **Step 6: Commit**

```bash
git add src/LinearAuthenticationProvider.ts src/test/providerRefresh.test.ts package.json yarn.lock
git commit -m "feat: refresh tokens, scope filtering, revoke on logout"
```

---

### Task 6: Manifest and version bump

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: working v2 provider from Task 5
- Produces: `"version": "2.0.0"`, `"engines": { "vscode": "^1.96.0" }`, empty activation events

- [ ] **Step 1: Update package.json manifest fields**

```json
{
  "version": "2.0.0",
  "engines": {
    "vscode": "^1.96.0"
  },
  "activationEvents": [],
  "extensionKind": ["ui"]
}
```

- [ ] **Step 2: Update CHANGELOG.md**

Append:

```markdown
## [2.0.0] - 2026-06-22

### Added
- Refresh token support for Linear's 2026 OAuth model (access tokens expire after ~24 hours)
- Automatic token refresh when sessions are requested
- Token revocation on logout via Linear's `/oauth/revoke` endpoint
- Unit tests for OAuth, scope, and session storage modules
- CI workflow

### Changed
- Scope-aware `getSessions` — returns only sessions matching requested scopes
- Replaced `@linear/sdk` viewer lookup with direct GraphQL fetch (smaller bundle)
- Minimum VS Code version raised to 1.96.0
- Removed redundant `activationEvents` (implicit activation since VS Code 1.74)

### Removed
- Dependencies: `@linear/sdk`, `node-fetch`, `uuid`

### Breaking
- Existing stored sessions without refresh tokens are invalidated; users must sign in again once after upgrading
```

- [ ] **Step 3: Verify package builds**

Run: `yarn esbuild && npx @vscode/vsce package --allow-missing-repository`
Expected: produces `linear-connect-2.0.0.vsix` without errors

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump to v2.0.0 and update manifest"
```

---

### Task 7: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts from Task 1 and Task 5
- Produces: GitHub Actions workflow running on push/PR

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn

      - run: yarn install --frozen-lockfile
      - run: yarn typecheck
      - run: yarn test
      - run: yarn esbuild
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck, test, and build workflow"
```

---

### Task 8: README fixes

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: v2 behavior
- Produces: corrected docs

- [ ] **Step 1: Fix typos and update publishing section**

In `README.md`:
- Change `extensionDepedencies` → `extensionDependencies` (both occurrences)
- Change `dependecy` → `dependency`
- Replace `npm i -g vsce` with `npm i -g @vscode/vsce`
- Replace `vsce package` with `vsce package` (same command, new package name)
- Add note under **How to use**:

```markdown
> **Note:** Linear Connect v2.0.0 requires VS Code 1.96.0 or later and uses refresh tokens. Users upgrading from v1.x will need to sign in again once.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: fix README typos and document v2 requirements"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Refresh tokens | Task 4, 5 |
| Revoke on logout | Task 4, 5 |
| Scope-aware getSessions | Task 2, 5 |
| Fix scope URL bug | Task 4 (`buildAuthorizeUrl`) |
| Drop @linear/sdk bundle | Task 4, 5 |
| Remove node-fetch/uuid | Task 5 |
| Engine bump + activationEvents | Task 6 |
| CI | Task 7 |
| CHANGELOG | Task 6 |
| README fixes | Task 8 |
| Test infrastructure | Task 1 |

**Not in this plan (follow-up plans):**
- PKCE migration (v2.1)
- Multi-account support (v2.2)
- l10n (v2.2)
- ESLint/Prettier (v2.1)

### Placeholder scan

No TBD/TODO/implement-later steps. All code blocks are complete.

### Type consistency

- `StoredLinearSession` defined in Task 3, used in Task 5
- `LinearTokenResponse` defined in Task 3, used in Task 4 and Task 5
- `scopesKey` / `scopesMatch` defined in Task 2, used in Task 5
- `parseStoredSessions` / `serializeStoredSessions` defined in Task 3, used in Task 5
- OAuth functions defined in Task 4, consumed in Task 5

---

## Manual verification checklist (after all tasks)

- [ ] F5 launch extension in Extension Development Host
- [ ] Run `Linear: Logout all Linear API sessions` (if logged in)
- [ ] From a dependent extension or test snippet, call `vscode.authentication.getSession("linear", ["read"], { createIfNone: true })`
- [ ] Confirm browser OAuth flow completes
- [ ] Confirm Accounts menu shows Linear session
- [ ] Logout removes session and revoke calls succeed (check Network tab if testing with proxy)
- [ ] Re-login works after logout

---

## Follow-up plans (separate documents)

1. `2026-06-22-linear-connect-v2.1-pkce-toolchain.md` — PKCE, remove embedded client secret, ESLint/Prettier
2. `2026-06-22-linear-connect-v2.2-multi-account-l10n.md` — `supportsMultipleAccounts`, localization

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-linear-connect-v2-auth-modernization.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
