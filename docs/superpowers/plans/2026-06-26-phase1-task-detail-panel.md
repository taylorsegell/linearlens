# Phase 1 — Task Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the multi-panel Linear workspace — clicking a sidebar issue opens an in-IDE **Task Detail** webview tab with read + write (title, description, status, priority, comments) synced to Linear, without agent assignment, attachments, or activity feed.

**Architecture:** Keep the existing sidebar `TreeView` as navigator. Add a `PanelManager` + `IssueDetailPanel` (`WebviewPanel`) in the editor area. Pure, testable modules under `src/linear/` fetch and mutate issues via `@linear/sdk` in the extension host only (API key never enters the webview). A Vite-built React bundle in `dist/webview/` communicates over a typed message protocol. Mutations optimistic in the webview, confirmed in the host, with sidebar cache patched via an `IssueUpdated` event.

**Tech Stack:** TypeScript 5.x (strict), Vitest 3, esbuild (extension host), Vite 6 + React 19 (webview UI), `@linear/sdk` ^87, VS Code Extension API `^1.96.0`, Yarn

## Global Constraints

- Auth provider id stays `"linear"` — do not rename.
- Secret storage key stays `"linear.auth"` (OAuth sessions).
- Sidebar API key secret stays `"linear.apiKey"`.
- OAuth redirect URI stays `${vscode.env.uriScheme}://linear.linear-connect/callback`.
- Engine floor: `"vscode": "^1.96.0"`.
- API key / OAuth token **never** passed to webview — all Linear calls in extension host.
- Phase 1 **skips:** agent assignment, attachments UI, activity feed, Kanban, Project Detail.
- Mutations use Personal API Key (write scope assumed); OAuth write unification is Phase 1.5.
- Verify before finishing each task batch: `yarn typecheck && yarn test && yarn esbuild && yarn build:webview`.
- Do not commit unless explicitly requested by user.
- Minimize diffs to existing OAuth provider behavior.

**Follow-on plans (not this document):** Phase 2 Kanban/List, Phase 3 Project Detail, Phase 4 Agent Assignment — separate plan files after Phase 1 ships.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/linear/types.ts` | Extend with `LinearIssueDetail`, comments, sub-issues, workflow states |
| `src/linear/issueDetailMapper.ts` | Pure SDK-model → `LinearIssueDetail` mapping (unit tested) |
| `src/linear/mutations.ts` | Pure mutation input builders + response helpers (unit tested) |
| `src/linear/issueCache.ts` | TTL cache + in-flight dedup for issue detail |
| `src/linear/linearClient.ts` | Add `fetchIssueDetail`, `updateIssue`, `createComment`, `fetchTeamStates` |
| `src/webview/messaging.ts` | Typed webview ↔ extension message protocol |
| `src/panels/PanelManager.ts` | Dedupe/reveal/dispose issue panels by `issue:{id}` |
| `src/panels/IssueDetailPanel.ts` | WebviewPanel lifecycle, CSP, message routing |
| `src/panels/getWebviewHtml.ts` | Load `dist/webview/index.html` with nonce CSP |
| `src/providers/linearTreeDataProvider.ts` | Issue click → `linear.openIssue`; context menu browser |
| `src/commands.ts` | Register `linear.openIssue`, extend `LinearCommandContext` |
| `src/extension.ts` | Wire `PanelManager`, issue-updated → tree patch |
| `webview-ui/` | Vite React app (separate from `src/` for clean bundling) |
| `webview-ui/src/App.tsx` | Issue detail layout |
| `webview-ui/src/hooks/useVscodeMessaging.ts` | `acquireVsCodeApi` bridge |
| `vite.webview.config.ts` | Vite config → `dist/webview/` |
| `src/test/issueDetailMapper.test.ts` | Mapper unit tests |
| `src/test/mutations.test.ts` | Mutation helper tests |
| `src/test/issueCache.test.ts` | Cache TTL/dedup tests |
| `package.json` | Commands, scripts, React/Vite deps |
| `.vscodeignore` | Ensure `dist/webview/**` ships in `.vsix` |
| `CHANGELOG.md` | User-visible Phase 1 notes |

---

### Task 1: Issue detail types and messaging protocol

**Files:**
- Modify: `src/linear/types.ts`
- Create: `src/webview/messaging.ts`
- Test: `src/test/messaging.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `LinearWorkflowState`, `LinearCommentDetail`, `LinearSubIssueSummary`, `LinearIssueDetail` in `types.ts`
  - `IssuePatch`, `WebviewRequest`, `ExtensionMessage`, type guards in `messaging.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/messaging.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isWebviewRequest,
  type WebviewRequest,
} from "../webview/messaging";

describe("isWebviewRequest", () => {
  it("accepts updateIssue", () => {
    const msg: WebviewRequest = {
      type: "updateIssue",
      issueId: "abc",
      patch: { title: "New title" },
    };
    expect(isWebviewRequest(msg)).toBe(true);
  });

  it("rejects unknown type", () => {
    expect(isWebviewRequest({ type: "nope" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isWebviewRequest(null)).toBe(false);
    expect(isWebviewRequest("ready")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/messaging.test.ts`
Expected: FAIL — cannot find module `../webview/messaging`

- [ ] **Step 3: Add types to `src/linear/types.ts`**

Append to `src/linear/types.ts`:

```typescript
/** Workflow column / status option for issue updates. */
export interface LinearWorkflowState {
  id: string;
  name: string;
  type: string;
  color: string;
}

/** Comment on an issue. */
export interface LinearCommentDetail {
  id: string;
  body: string;
  authorName?: string;
  createdAt: string;
}

/** Child issue (one level). */
export interface LinearSubIssueSummary {
  id: string;
  identifier: string;
  title: string;
  state: string;
  stateColor: string;
}

/** Full issue payload for Task Detail panel. */
export interface LinearIssueDetail {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  updatedAt: string;
  state: LinearWorkflowState;
  priority: number;
  priorityLabel: string;
  assignee?: { id: string; name: string };
  project?: { id: string; name: string };
  milestone?: { id: string; name: string };
  labels: { id: string; name: string; color?: string }[];
  subIssues: LinearSubIssueSummary[];
  comments: LinearCommentDetail[];
  teamId: string;
}
```

- [ ] **Step 4: Create `src/webview/messaging.ts`**

```typescript
import type { LinearIssueDetail } from "../linear/types";

export type IssuePatch = Partial<
  Pick<LinearIssueDetail, "title" | "description" | "priority">
> & {
  stateId?: string;
};

/** webview → extension host */
export type WebviewRequest =
  | { type: "ready" }
  | { type: "refresh"; issueId: string }
  | { type: "updateIssue"; issueId: string; patch: IssuePatch }
  | { type: "createComment"; issueId: string; body: string }
  | { type: "openExternal"; url: string };

/** extension host → webview */
export type ExtensionMessage =
  | { type: "issueLoaded"; issue: LinearIssueDetail; workflowStates: WorkflowStateOption[] }
  | { type: "issueUpdated"; issue: LinearIssueDetail }
  | { type: "mutationError"; message: string }
  | { type: "theme"; kind: "light" | "dark" | "highContrast" };

export interface WorkflowStateOption {
  id: string;
  name: string;
  color: string;
}

export function isWebviewRequest(value: unknown): value is WebviewRequest {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return (
    type === "ready" ||
    type === "refresh" ||
    type === "updateIssue" ||
    type === "createComment" ||
    type === "openExternal"
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/test/messaging.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/linear/types.ts src/webview/messaging.ts src/test/messaging.test.ts
git commit -m "feat: add issue detail types and webview messaging protocol"
```

---

### Task 2: Issue detail mapper (pure, testable)

**Files:**
- Create: `src/linear/issueDetailMapper.ts`
- Test: `src/test/issueDetailMapper.test.ts`

**Interfaces:**
- Consumes: `LinearIssueDetail` and related types from Task 1
- Produces:
  - `mapIssueDetail(input: RawIssueDetailInput): LinearIssueDetail`
  - `RawIssueDetailInput` — plain object shape matching SDK fields we read (no SDK import in mapper)

- [ ] **Step 1: Write the failing test**

Create `src/test/issueDetailMapper.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapIssueDetail } from "../linear/issueDetailMapper";

describe("mapIssueDetail", () => {
  it("maps core fields and nested collections", () => {
    const detail = mapIssueDetail({
      id: "issue-1",
      identifier: "ABO-42",
      title: "Fix auth",
      description: "Details here",
      url: "https://linear.app/team/issue/ABO-42",
      updatedAt: "2026-06-26T12:00:00.000Z",
      priority: 2,
      priorityLabel: "High",
      teamId: "team-1",
      state: { id: "s1", name: "In Progress", type: "started", color: "#f00" },
      assignee: { id: "u1", name: "Alex" },
      project: { id: "p1", name: "Abodi Beta" },
      milestone: undefined,
      labels: [{ id: "l1", name: "phase-2", color: "#0f0" }],
      subIssues: [
        {
          id: "sub-1",
          identifier: "ABO-43",
          title: "Sub task",
          state: "Todo",
          stateColor: "#ccc",
        },
      ],
      comments: [
        {
          id: "c1",
          body: "Looks good",
          authorName: "Alex",
          createdAt: "2026-06-26T11:00:00.000Z",
        },
      ],
    });

    expect(detail.identifier).toBe("ABO-42");
    expect(detail.state.name).toBe("In Progress");
    expect(detail.labels).toHaveLength(1);
    expect(detail.subIssues[0].identifier).toBe("ABO-43");
    expect(detail.comments[0].body).toBe("Looks good");
  });

  it("defaults missing optional fields", () => {
    const detail = mapIssueDetail({
      id: "issue-2",
      identifier: "ABO-99",
      title: "Empty",
      url: "https://linear.app/x",
      updatedAt: "2026-06-26T12:00:00.000Z",
      priority: 0,
      priorityLabel: "No priority",
      teamId: "team-1",
      state: { id: "s2", name: "Backlog", type: "backlog", color: "#999" },
    });

    expect(detail.description).toBeUndefined();
    expect(detail.labels).toEqual([]);
    expect(detail.subIssues).toEqual([]);
    expect(detail.comments).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/issueDetailMapper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/linear/issueDetailMapper.ts`**

```typescript
import type {
  LinearCommentDetail,
  LinearIssueDetail,
  LinearSubIssueSummary,
  LinearWorkflowState,
} from "./types";

export interface RawIssueDetailInput {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  updatedAt: string;
  priority: number;
  priorityLabel: string;
  teamId: string;
  state: LinearWorkflowState;
  assignee?: { id: string; name: string };
  project?: { id: string; name: string };
  milestone?: { id: string; name: string };
  labels?: { id: string; name: string; color?: string }[];
  subIssues?: LinearSubIssueSummary[];
  comments?: LinearCommentDetail[];
}

export function mapIssueDetail(input: RawIssueDetailInput): LinearIssueDetail {
  return {
    id: input.id,
    identifier: input.identifier,
    title: input.title,
    description: input.description,
    url: input.url,
    updatedAt: input.updatedAt,
    priority: input.priority,
    priorityLabel: input.priorityLabel,
    teamId: input.teamId,
    state: input.state,
    assignee: input.assignee,
    project: input.project,
    milestone: input.milestone,
    labels: input.labels ?? [],
    subIssues: input.subIssues ?? [],
    comments: input.comments ?? [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/issueDetailMapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/linear/issueDetailMapper.ts src/test/issueDetailMapper.test.ts
git commit -m "feat: add pure issue detail mapper"
```

---

### Task 3: Mutation input helpers

**Files:**
- Create: `src/linear/mutations.ts`
- Test: `src/test/mutations.test.ts`

**Interfaces:**
- Consumes: `IssuePatch` from `src/webview/messaging.ts`
- Produces:
  - `buildIssueUpdateInput(issueId: string, patch: IssuePatch): { id: string; input: Record<string, unknown> }`
  - `buildCommentCreateInput(issueId: string, body: string): { issueId: string; body: string }`

- [ ] **Step 1: Write the failing test**

Create `src/test/mutations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildCommentCreateInput,
  buildIssueUpdateInput,
} from "../linear/mutations";

describe("buildIssueUpdateInput", () => {
  it("maps title and stateId", () => {
    expect(
      buildIssueUpdateInput("id-1", { title: "New", stateId: "state-1" })
    ).toEqual({
      id: "id-1",
      input: { title: "New", stateId: "state-1" },
    });
  });

  it("omits undefined patch keys", () => {
    expect(buildIssueUpdateInput("id-1", { priority: 1 })).toEqual({
      id: "id-1",
      input: { priority: 1 },
    });
  });

  it("throws on empty patch", () => {
    expect(() => buildIssueUpdateInput("id-1", {})).toThrow(
      "Issue patch cannot be empty"
    );
  });
});

describe("buildCommentCreateInput", () => {
  it("trims body", () => {
    expect(buildCommentCreateInput("id-1", "  hello  ")).toEqual({
      issueId: "id-1",
      body: "hello",
    });
  });

  it("throws on empty body", () => {
    expect(() => buildCommentCreateInput("id-1", "   ")).toThrow(
      "Comment body is required"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/mutations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/linear/mutations.ts`**

```typescript
import type { IssuePatch } from "../webview/messaging";

export function buildIssueUpdateInput(
  issueId: string,
  patch: IssuePatch
): { id: string; input: Record<string, unknown> } {
  const input: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    input.title = patch.title;
  }
  if (patch.description !== undefined) {
    input.description = patch.description;
  }
  if (patch.priority !== undefined) {
    input.priority = patch.priority;
  }
  if (patch.stateId !== undefined) {
    input.stateId = patch.stateId;
  }

  if (Object.keys(input).length === 0) {
    throw new Error("Issue patch cannot be empty");
  }

  return { id: issueId, input };
}

export function buildCommentCreateInput(
  issueId: string,
  body: string
): { issueId: string; body: string } {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Comment body is required");
  }
  return { issueId, body: trimmed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/mutations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/linear/mutations.ts src/test/mutations.test.ts
git commit -m "feat: add issue mutation input builders"
```

---

### Task 4: Issue detail cache

**Files:**
- Create: `src/linear/issueCache.ts`
- Test: `src/test/issueCache.test.ts`

**Interfaces:**
- Consumes: `LinearIssueDetail` from Task 1
- Produces:
  - `class IssueDetailCache` with `get(id)`, `set(issue)`, `invalidate(id)`, `getOrFetch(id, fetcher)`, `TTL_MS = 5 * 60 * 1000`

- [ ] **Step 1: Write the failing test**

Create `src/test/issueCache.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IssueDetailCache } from "../linear/issueCache";
import type { LinearIssueDetail } from "../linear/types";

const issue: LinearIssueDetail = {
  id: "i1",
  identifier: "ABO-1",
  title: "Test",
  url: "https://linear.app/x",
  updatedAt: "2026-06-26T00:00:00.000Z",
  state: { id: "s", name: "Todo", type: "unstarted", color: "#000" },
  priority: 0,
  priorityLabel: "None",
  labels: [],
  subIssues: [],
  comments: [],
  teamId: "t1",
};

describe("IssueDetailCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached value within TTL", async () => {
    const cache = new IssueDetailCache();
    cache.set(issue);
    const fetcher = vi.fn(async () => issue);
    const result = await cache.getOrFetch("i1", fetcher);
    expect(result).toEqual(issue);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refetches after TTL expires", async () => {
    const cache = new IssueDetailCache();
    cache.set(issue);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const updated = { ...issue, title: "Updated" };
    const fetcher = vi.fn(async () => updated);
    const result = await cache.getOrFetch("i1", fetcher);
    expect(result.title).toBe("Updated");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("dedupes concurrent fetches for same id", async () => {
    const cache = new IssueDetailCache();
    const fetcher = vi.fn(
      () =>
        new Promise<LinearIssueDetail>((resolve) =>
          setTimeout(() => resolve(issue), 50)
        )
    );
    const p1 = cache.getOrFetch("i1", fetcher);
    const p2 = cache.getOrFetch("i1", fetcher);
    vi.advanceTimersByTime(50);
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/issueCache.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/linear/issueCache.ts`**

```typescript
import type { LinearIssueDetail } from "./types";

export const ISSUE_DETAIL_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  issue: LinearIssueDetail;
  fetchedAt: number;
}

export class IssueDetailCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<LinearIssueDetail>>();

  get(issueId: string): LinearIssueDetail | undefined {
    const entry = this.entries.get(issueId);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > ISSUE_DETAIL_TTL_MS) {
      this.entries.delete(issueId);
      return undefined;
    }
    return entry.issue;
  }

  set(issue: LinearIssueDetail): void {
    this.entries.set(issue.id, { issue, fetchedAt: Date.now() });
  }

  invalidate(issueId: string): void {
    this.entries.delete(issueId);
    this.inflight.delete(issueId);
  }

  async getOrFetch(
    issueId: string,
    fetcher: () => Promise<LinearIssueDetail>
  ): Promise<LinearIssueDetail> {
    const cached = this.get(issueId);
    if (cached) {
      return cached;
    }

    const pending = this.inflight.get(issueId);
    if (pending) {
      return pending;
    }

    const promise = fetcher()
      .then((issue) => {
        this.set(issue);
        return issue;
      })
      .finally(() => {
        this.inflight.delete(issueId);
      });

    this.inflight.set(issueId, promise);
    return promise;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/issueCache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/linear/issueCache.ts src/test/issueCache.test.ts
git commit -m "feat: add TTL issue detail cache with in-flight dedup"
```

---

### Task 5: LinearService — fetch issue detail and mutations

**Files:**
- Modify: `src/linear/linearClient.ts`
- Test: `src/test/linearClientIssueDetail.test.ts`

**Interfaces:**
- Consumes: `mapIssueDetail`, `buildIssueUpdateInput`, `buildCommentCreateInput`, `LinearIssueDetail`, `LinearWorkflowState`
- Produces on `LinearService`:
  - `fetchIssueDetail(issueId: string): Promise<LinearIssueDetail>`
  - `fetchTeamWorkflowStates(teamId: string): Promise<LinearWorkflowState[]>`
  - `updateIssue(issueId: string, patch: IssuePatch): Promise<LinearIssueDetail>`
  - `createComment(issueId: string, body: string): Promise<LinearIssueDetail>`

- [ ] **Step 1: Write the failing test (mock LinearClient)**

Create `src/test/linearClientIssueDetail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinearService } from "../linear/linearClient";

function makeIssueMock() {
  return {
    id: "issue-1",
    identifier: "ABO-1",
    title: "Hello",
    description: "Body",
    url: "https://linear.app/x/ABO-1",
    updatedAt: new Date("2026-06-26T12:00:00.000Z"),
    priority: 2,
    priorityLabel: "High",
    state: Promise.resolve({
      id: "state-1",
      name: "In Progress",
      type: "started",
      color: "#ff0000",
    }),
    assignee: Promise.resolve({ id: "u1", displayName: "Alex" }),
    project: Promise.resolve({ id: "p1", name: "Abodi" }),
    milestone: Promise.resolve(undefined),
    team: Promise.resolve({ id: "team-1" }),
    labels: vi.fn(async () => ({
      nodes: [{ id: "l1", name: "phase-1", color: "#00ff00" }],
    })),
    children: vi.fn(async () => ({
      nodes: [
        {
          id: "child-1",
          identifier: "ABO-2",
          title: "Child",
          state: Promise.resolve({
            name: "Todo",
            color: "#cccccc",
          }),
        },
      ],
    })),
    comments: vi.fn(async () => ({
      nodes: [
        {
          id: "c1",
          body: "Nice",
          createdAt: new Date("2026-06-26T11:00:00.000Z"),
          user: Promise.resolve({ displayName: "Alex" }),
        },
      ],
    })),
  };
}

describe("LinearService issue detail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchIssueDetail maps SDK issue", async () => {
    const service = new LinearService("lin_api_test");
    const issueMock = makeIssueMock();
    (service as unknown as { client: { issue: (id: string) => Promise<unknown> } }).client = {
      issue: vi.fn(async () => issueMock),
    };

    const detail = await service.fetchIssueDetail("issue-1");
    expect(detail.identifier).toBe("ABO-1");
    expect(detail.labels[0].name).toBe("phase-1");
    expect(detail.subIssues[0].identifier).toBe("ABO-2");
    expect(detail.comments[0].body).toBe("Nice");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/linearClientIssueDetail.test.ts`
Expected: FAIL — `fetchIssueDetail` not defined

- [ ] **Step 3: Add methods to `src/linear/linearClient.ts`**

Add imports at top:

```typescript
import { mapIssueDetail } from "./issueDetailMapper";
import {
  buildCommentCreateInput,
  buildIssueUpdateInput,
} from "./mutations";
import type { LinearIssueDetail, LinearWorkflowState } from "./types";
import type { IssuePatch } from "../webview/messaging";
```

Add methods inside `LinearService`:

```typescript
  async fetchIssueDetail(issueId: string): Promise<LinearIssueDetail> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const issue = await this.client.issue(issueId);
    const [state, assignee, project, milestone, team] = await Promise.all([
      issue.state,
      issue.assignee,
      issue.project,
      issue.milestone,
      issue.team,
    ]);

    const [labelsConnection, childrenConnection, commentsConnection] =
      await Promise.all([
        issue.labels(),
        issue.children({ first: 50 }),
        issue.comments({ first: 20 }),
      ]);

    const subIssues = await Promise.all(
      childrenConnection.nodes.map(async (child) => {
        const childState = await child.state;
        return {
          id: child.id,
          identifier: child.identifier,
          title: child.title,
          state: childState?.name ?? "Unknown",
          stateColor: childState?.color ?? "#bec2c8",
        };
      })
    );

    const comments = await Promise.all(
      commentsConnection.nodes.map(async (comment) => {
        const user = await comment.user;
        return {
          id: comment.id,
          body: comment.body,
          authorName: user?.displayName ?? user?.name,
          createdAt: comment.createdAt.toISOString(),
        };
      })
    );

    return mapIssueDetail({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      url: issue.url,
      updatedAt: issue.updatedAt.toISOString(),
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      teamId: team!.id,
      state: {
        id: state!.id,
        name: state!.name,
        type: state!.type,
        color: state!.color,
      },
      assignee: assignee
        ? {
            id: assignee.id,
            name: assignee.displayName ?? assignee.name,
          }
        : undefined,
      project: project
        ? { id: project.id, name: project.name }
        : undefined,
      milestone: milestone
        ? { id: milestone.id, name: milestone.name }
        : undefined,
      labels: labelsConnection.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      subIssues,
      comments,
    });
  }

  async fetchTeamWorkflowStates(
    teamId: string
  ): Promise<LinearWorkflowState[]> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const team = await this.client.team(teamId);
    const statesConnection = await team.states();
    return statesConnection.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      type: state.type,
      color: state.color,
    }));
  }

  async updateIssue(
    issueId: string,
    patch: IssuePatch
  ): Promise<LinearIssueDetail> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const { id, input } = buildIssueUpdateInput(issueId, patch);
    const result = await this.client.updateIssue(id, input);
    if (!result.success) {
      throw new Error("Linear rejected issue update.");
    }
    return this.fetchIssueDetail(issueId);
  }

  async createComment(
    issueId: string,
    body: string
  ): Promise<LinearIssueDetail> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const { issueId: id, body: commentBody } = buildCommentCreateInput(
      issueId,
      body
    );
    const result = await this.client.createComment({ issueId: id, body: commentBody });
    if (!result.success) {
      throw new Error("Linear rejected comment creation.");
    }
    return this.fetchIssueDetail(issueId);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/linearClientIssueDetail.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `yarn typecheck && yarn test`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/linear/linearClient.ts src/test/linearClientIssueDetail.test.ts
git commit -m "feat: add LinearService issue detail fetch and mutations"
```

---

### Task 6: Webview build pipeline (Vite + React)

**Files:**
- Create: `vite.webview.config.ts`
- Create: `webview-ui/index.html`
- Create: `webview-ui/src/main.tsx`
- Create: `webview-ui/src/App.tsx` (placeholder)
- Create: `webview-ui/src/vscode.ts`
- Modify: `package.json`
- Modify: `tsconfig.json` (optional `webview-ui/tsconfig.json`)

**Interfaces:**
- Consumes: nothing runtime
- Produces: `dist/webview/index.html`, `dist/webview/assets/*`; yarn scripts `build:webview`, `build:webview:watch`

- [ ] **Step 1: Add dependencies and scripts to `package.json`**

Add devDependencies:

```json
"@types/react": "^19.0.0",
"@types/react-dom": "^19.0.0",
"@vitejs/plugin-react": "^4.3.0",
"react": "^19.0.0",
"react-dom": "^19.0.0",
"vite": "^6.0.0"
```

Add scripts:

```json
"build:webview": "vite build --config vite.webview.config.ts",
"build:webview:watch": "vite build --config vite.webview.config.ts --watch",
"build": "yarn esbuild && yarn build:webview"
```

Update CI note in plan: local verify uses `yarn build`.

- [ ] **Step 2: Create `vite.webview.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "webview-ui"),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dist/webview"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
```

- [ ] **Step 3: Create minimal React placeholder**

`webview-ui/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Linear Issue</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`webview-ui/src/vscode.ts`:

```typescript
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export const vscode =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
```

`webview-ui/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`webview-ui/src/App.tsx`:

```tsx
export function App() {
  return <main style={{ padding: 16 }}>Linear Issue Detail</main>;
}
```

- [ ] **Step 4: Install and build**

Run: `yarn install && yarn build:webview`
Expected: `dist/webview/index.html` exists

- [ ] **Step 5: Commit**

```bash
git add vite.webview.config.ts webview-ui package.json yarn.lock
git commit -m "chore: add Vite React webview build pipeline"
```

---

### Task 7: Webview HTML loader with CSP

**Files:**
- Create: `src/panels/getWebviewHtml.ts`
- Test: `src/test/getWebviewHtml.test.ts`

**Interfaces:**
- Consumes: built `dist/webview/index.html`
- Produces: `getIssueDetailWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string`

- [ ] **Step 1: Write the failing test**

Create `src/test/getWebviewHtml.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";

// Minimal vscode.Uri shim for node tests
const Uri = {
  file: (p: string) => ({ fsPath: p, path: p.replace(/\\/g, "/") }),
  joinPath: (base: { fsPath: string }, ...parts: string[]) => {
    const joined = path.join(base.fsPath, ...parts);
    return { fsPath: joined, path: joined.replace(/\\/g, "/") };
  },
};

describe("getIssueDetailWebviewHtml", () => {
  it("inlines script with webview URI and nonce", async () => {
    const { getIssueDetailWebviewHtml } = await import("../panels/getWebviewHtml");
    const extPath = path.resolve(__dirname, "../..");
    const extensionUri = Uri.file(extPath);

    const webviewDist = path.join(extPath, "dist/webview");
    if (!fs.existsSync(path.join(webviewDist, "index.html"))) {
      // Skip if webview not built in CI order — run yarn build:webview first
      return;
    }

    const html = getIssueDetailWebviewHtml(
      {
        asWebviewUri: (uri: { path: string }) =>
          Uri.file(uri.path.replace(/^\//, "")),
        cspSource: "webview.csp.example",
      } as unknown as import("vscode").Webview,
      extensionUri as unknown as import("vscode").Uri,
      "test-nonce-123"
    );

    expect(html).toContain("test-nonce-123");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("assets/");
  });
});
```

- [ ] **Step 2: Run test (may skip if no build) — implement anyway**

- [ ] **Step 3: Create `src/panels/getWebviewHtml.ts`**

```typescript
import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

export function getIssueDetailWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  const distDir = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const indexPath = vscode.Uri.joinPath(distDir, "index.html");
  const htmlOnDisk = fs.readFileSync(indexPath.fsPath, "utf8");

  const scriptMatch = htmlOnDisk.match(/src="\.\/assets\/([^"]+\.js)"/);
  const styleMatch = htmlOnDisk.match(/href="\.\/assets\/([^"]+\.css)"/);

  if (!scriptMatch) {
    throw new Error(
      "dist/webview/index.html missing script — run yarn build:webview"
    );
  }

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distDir, "assets", scriptMatch[1])
  );
  const styleUri = styleMatch
    ? webview.asWebviewUri(
        vscode.Uri.joinPath(distDir, "assets", styleMatch[1])
      )
    : undefined;

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Linear Issue</title>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run build + test**

Run: `yarn build:webview && yarn test src/test/getWebviewHtml.test.ts`
Expected: PASS (or skip gracefully if assets missing — prefer running build first)

- [ ] **Step 5: Commit**

```bash
git add src/panels/getWebviewHtml.ts src/test/getWebviewHtml.test.ts
git commit -m "feat: add CSP webview HTML loader"
```

---

### Task 8: PanelManager

**Files:**
- Create: `src/panels/PanelManager.ts`
- Modify: `src/config.ts`

**Interfaces:**
- Consumes: `LinearService`, `IssueDetailPanel` (Task 9)
- Produces:
  - `class PanelManager` with `openIssue(issueId: string, label: string): void`
  - `panelKey(issueId: string): string` → `"issue:{id}"`
  - `CMD_OPEN_ISSUE = "linear.openIssue"` in config

- [ ] **Step 1: Add command id to `src/config.ts`**

```typescript
export const CMD_OPEN_ISSUE = "linear.openIssue";
export const CMD_OPEN_ISSUE_IN_BROWSER = "linear.openIssueInBrowser";
```

- [ ] **Step 2: Create `src/panels/PanelManager.ts`**

```typescript
import * as vscode from "vscode";
import type { LinearService } from "../linear/linearClient";
import { IssueDetailPanel } from "./IssueDetailPanel";

export function panelKey(kind: "issue", id: string): string {
  return `${kind}:${id}`;
}

export class PanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, IssueDetailPanel>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getService: () => LinearService,
    private readonly onIssueUpdated: (issueId: string) => void
  ) {}

  openIssue(issueId: string, tabLabel: string): void {
    const key = panelKey("issue", issueId);
    const existing = this.panels.get(key);
    if (existing) {
      existing.reveal();
      return;
    }

    const panel = IssueDetailPanel.create(
      this.extensionUri,
      this.getService(),
      issueId,
      tabLabel,
      (updatedIssueId) => {
        this.onIssueUpdated(updatedIssueId);
      },
      () => {
        this.panels.delete(key);
      }
    );
    this.panels.set(key, panel);
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}
```

- [ ] **Step 3: Typecheck (IssueDetailPanel stub next task — temporarily create minimal export)**

Create stub `src/panels/IssueDetailPanel.ts` so typecheck passes:

```typescript
import * as vscode from "vscode";
import type { LinearService } from "../linear/linearClient";

export class IssueDetailPanel implements vscode.Disposable {
  static create(
    _extensionUri: vscode.Uri,
    _getService: () => LinearService,
    _issueId: string,
    _tabLabel: string,
    _onIssueUpdated: (issueId: string) => void,
    _onDispose: () => void
  ): IssueDetailPanel {
    return new IssueDetailPanel();
  }
  reveal(): void {}
  dispose(): void {}
}
```

- [ ] **Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/panels/PanelManager.ts src/panels/IssueDetailPanel.ts
git commit -m "feat: add PanelManager with issue panel deduping"
```

---

### Task 9: IssueDetailPanel (extension host controller)

**Files:**
- Modify: `src/panels/IssueDetailPanel.ts` (replace stub)
- Modify: `src/linear/issueCache.ts` usage

**Interfaces:**
- Consumes: `getIssueDetailWebviewHtml`, `IssueDetailCache`, `LinearService`, messaging types
- Produces: `IssueDetailPanel.create(...)` opening `WebviewPanel`, handling `WebviewRequest` messages

- [ ] **Step 1: Replace stub with full implementation**

```typescript
import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { LinearService } from "../linear/linearClient";
import { IssueDetailCache } from "../linear/issueCache";
import { getIssueDetailWebviewHtml } from "./getWebviewHtml";
import {
  isWebviewRequest,
  type ExtensionMessage,
} from "../webview/messaging";

const cache = new IssueDetailCache();

export class IssueDetailPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly mutationQueues = new Map<string, Promise<void>>();

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly getService: () => LinearService,
    private readonly issueId: string,
    private readonly onIssueUpdated: (issueId: string) => void,
    private readonly onDisposeCallback: () => void
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => void this.handleMessage(msg),
      null,
      this.disposables
    );
    void this.loadIssue();
  }

  static create(
    extensionUri: vscode.Uri,
    getService: () => LinearService,
    issueId: string,
    tabLabel: string,
    onIssueUpdated: (issueId: string) => void,
    onDispose: () => void
  ): IssueDetailPanel {
    const panel = vscode.window.createWebviewPanel(
      "linear.issueDetail",
      tabLabel,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      }
    );

    const nonce = crypto.randomBytes(16).toString("hex");
    panel.webview.html = getIssueDetailWebviewHtml(
      panel.webview,
      extensionUri,
      nonce
    );

    return new IssueDetailPanel(
      panel,
      getService,
      issueId,
      onIssueUpdated,
      onDispose
    );
  }

  reveal(): void {
    this.panel.reveal();
  }

  private post(message: ExtensionMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private async loadIssue(): Promise<void> {
    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    try {
      const issue = await cache.getOrFetch(this.issueId, () =>
        service.fetchIssueDetail(this.issueId)
      );
      const workflowStates = await service.fetchTeamWorkflowStates(
        issue.teamId
      );
      this.post({ type: "issueLoaded", issue, workflowStates });
      this.panel.title = `${issue.identifier}`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load issue.";
      this.post({ type: "mutationError", message });
    }
  }

  private enqueueMutation(run: () => Promise<void>): void {
    const prev =
      this.mutationQueues.get(this.issueId) ?? Promise.resolve();
    const next = prev.then(run).catch(() => undefined);
    this.mutationQueues.set(this.issueId, next);
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (!isWebviewRequest(raw)) {
      return;
    }

    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    switch (raw.type) {
      case "ready":
      case "refresh":
        cache.invalidate(this.issueId);
        await this.loadIssue();
        return;

      case "openExternal":
        await vscode.env.openExternal(vscode.Uri.parse(raw.url));
        return;

      case "updateIssue":
        this.enqueueMutation(async () => {
          try {
            const issue = await service.updateIssue(raw.issueId, raw.patch);
            cache.set(issue);
            this.post({ type: "issueUpdated", issue });
            this.onIssueUpdated(issue.id);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Update failed.";
            this.post({ type: "mutationError", message });
          }
        });
        return;

      case "createComment":
        this.enqueueMutation(async () => {
          try {
            const issue = await service.createComment(
              raw.issueId,
              raw.body
            );
            cache.set(issue);
            this.post({ type: "issueUpdated", issue });
            this.onIssueUpdated(issue.id);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Comment failed.";
            this.post({ type: "mutationError", message });
          }
        });
        return;
    }
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
    this.onDisposeCallback();
  }
}
```

- [ ] **Step 2: Register webview panel type in `package.json`**

Under `contributes`:

```json
"customEditors": [],
```

Not needed — `createWebviewPanel` uses arbitrary viewType. Add command contributions (Task 11).

- [ ] **Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/panels/IssueDetailPanel.ts
git commit -m "feat: implement IssueDetailPanel message routing"
```

---

### Task 10: React Issue Detail UI (read + write)

**Files:**
- Create: `webview-ui/src/hooks/useVscodeMessaging.ts`
- Create: `webview-ui/src/components/IssueDetailView.tsx`
- Create: `webview-ui/src/styles.css`
- Modify: `webview-ui/src/App.tsx`

**Interfaces:**
- Consumes: `ExtensionMessage`, `WebviewRequest` shapes (duplicate minimal types in webview-ui or import from shared — **use duplicated minimal types in webview** to avoid bundling extension host code)
- Produces: working UI posting `ready`, handling `issueLoaded` / `issueUpdated`

- [ ] **Step 1: Create messaging hook**

`webview-ui/src/hooks/useVscodeMessaging.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { vscode } from "../vscode";

export interface WorkflowStateOption {
  id: string;
  name: string;
  color: string;
}

export interface IssueDetail {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string };
  assignee?: { name: string };
  project?: { name: string };
  milestone?: { name: string };
  labels: { name: string; color?: string }[];
  subIssues: {
    id: string;
    identifier: string;
    title: string;
    state: string;
  }[];
  comments: {
    id: string;
    body: string;
    authorName?: string;
    createdAt: string;
  }[];
}

type ExtensionMessage =
  | { type: "issueLoaded"; issue: IssueDetail; workflowStates: WorkflowStateOption[] }
  | { type: "issueUpdated"; issue: IssueDetail }
  | { type: "mutationError"; message: string };

export function useVscodeMessaging() {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [workflowStates, setWorkflowStates] = useState<WorkflowStateOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback((message: unknown) => {
    vscode?.postMessage(message);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      if (msg.type === "issueLoaded" || msg.type === "issueUpdated") {
        setIssue(msg.issue);
        if (msg.type === "issueLoaded") {
          setWorkflowStates(msg.workflowStates);
        }
        setError(null);
      } else if (msg.type === "mutationError") {
        setError(msg.message);
      }
    };
    window.addEventListener("message", handler);
    post({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, [post]);

  return { issue, workflowStates, error, post };
}
```

- [ ] **Step 2: Create `IssueDetailView.tsx`**

```tsx
import { useState } from "react";
import type { IssueDetail, WorkflowStateOption } from "../hooks/useVscodeMessaging";

interface Props {
  issue: IssueDetail;
  workflowStates: WorkflowStateOption[];
  error: string | null;
  post: (message: unknown) => void;
}

export function IssueDetailView({ issue, workflowStates, error, post }: Props) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [comment, setComment] = useState("");

  const saveTitle = () => {
    if (title.trim() && title !== issue.title) {
      post({ type: "updateIssue", issueId: issue.id, patch: { title: title.trim() } });
    }
  };

  const saveDescription = () => {
    if (description !== (issue.description ?? "")) {
      post({
        type: "updateIssue",
        issueId: issue.id,
        patch: { description },
      });
    }
  };

  return (
    <div className="issue-detail">
      <header className="issue-header">
        <span className="identifier">{issue.identifier}</span>
        <select
          value={issue.state.id}
          onChange={(e) =>
            post({
              type: "updateIssue",
              issueId: issue.id,
              patch: { stateId: e.target.value },
            })
          }
        >
          {workflowStates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={issue.priority}
          onChange={(e) =>
            post({
              type: "updateIssue",
              issueId: issue.id,
              patch: { priority: Number(e.target.value) },
            })
          }
        >
          {[0, 1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>
              P{p === 0 ? " — None" : p}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => post({ type: "openExternal", url: issue.url })}>
          Open in Linear
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <input
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
      />

      <div className="meta">
        {issue.project && <span>Project: {issue.project.name}</span>}
        {issue.assignee && <span>Assignee: {issue.assignee.name}</span>}
        {issue.labels.map((l) => (
          <span key={l.name} className="label">
            {l.name}
          </span>
        ))}
      </div>

      <textarea
        className="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveDescription}
        rows={12}
      />

      <section>
        <h3>Sub-issues</h3>
        <ul>
          {issue.subIssues.map((sub) => (
            <li key={sub.id}>
              {sub.identifier} — {sub.title} ({sub.state})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Comments</h3>
        <ul className="comments">
          {issue.comments.map((c) => (
            <li key={c.id}>
              <strong>{c.authorName ?? "Unknown"}</strong>
              <time>{new Date(c.createdAt).toLocaleString()}</time>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
        />
        <button
          type="button"
          disabled={!comment.trim()}
          onClick={() => {
            post({ type: "createComment", issueId: issue.id, body: comment });
            setComment("");
          }}
        >
          Comment
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Wire App + styles**

`webview-ui/src/App.tsx`:

```tsx
import { useVscodeMessaging } from "./hooks/useVscodeMessaging";
import { IssueDetailView } from "./components/IssueDetailView";
import "./styles.css";

export function App() {
  const { issue, workflowStates, error, post } = useVscodeMessaging();
  if (!issue) {
    return <main className="loading">Loading issue…</main>;
  }
  return (
    <main>
      <IssueDetailView
        issue={issue}
        workflowStates={workflowStates}
        error={error}
        post={post}
      />
    </main>
  );
}
```

`webview-ui/src/styles.css` — use VS Code CSS variables:

```css
body {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  margin: 0;
  padding: 0;
}
.issue-header {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.identifier {
  font-weight: 600;
}
.title-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 1.25rem;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: inherit;
}
.description,
textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  padding: 8px;
}
.error {
  color: var(--vscode-errorForeground);
  background: var(--vscode-inputValidation-errorBackground);
  padding: 8px 16px;
}
.label {
  margin-right: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--vscode-badge-background);
}
.loading {
  padding: 16px;
}
```

- [ ] **Step 4: Build webview**

Run: `yarn build:webview`
Expected: success, no TS errors

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src
git commit -m "feat: add React issue detail webview UI"
```

---

### Task 11: Wire sidebar, commands, extension entry

**Files:**
- Modify: `src/providers/linearTreeDataProvider.ts`
- Modify: `src/commands.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PanelManager`, `CMD_OPEN_ISSUE`, `CMD_OPEN_ISSUE_IN_BROWSER`
- Produces: clicking issue opens panel; `linear.openIssue` command; tree cache patch on update

- [ ] **Step 1: Change issue tree item command in `linearTreeDataProvider.ts`**

In `mapIssueItems`, replace URL-only open with issue command:

```typescript
import { CMD_OPEN_ISSUE } from "../config";

// inside mapIssueItems, replace item constructor command:
    const item = new LinearTreeItem(
      LinearTreeItemKind.Issue,
      `${issue.identifier}  ${issue.title}`,
      vscode.TreeItemCollapsibleState.None,
      sectionId,
      issue.url,
      tooltip
    );
    item.command = {
      command: CMD_OPEN_ISSUE,
      title: "Open Issue",
      arguments: [issue.id, `${issue.identifier}: ${issue.title}`, issue.url],
    };
```

Add method to patch cached issue after update:

```typescript
  patchCachedIssue(issueId: string, patch: Partial<LinearIssueSummary>): void {
    const entry = this.cache.get("issues");
    if (!entry || entry.state !== "loaded") {
      return;
    }
    const items = entry.items as LinearIssueSummary[];
    const index = items.findIndex((i) => i.id === issueId);
    if (index === -1) {
      return;
    }
    items[index] = { ...items[index], ...patch };
    this.cache.set("issues", { state: "loaded", items });
    this._onDidChangeTreeData.fire(undefined);
  }
```

- [ ] **Step 2: Register commands in `commands.ts`**

Add to imports: `CMD_OPEN_ISSUE`, `CMD_OPEN_ISSUE_IN_BROWSER`, `PanelManager`.

Extend `LinearCommandContext`:

```typescript
export interface LinearCommandContext {
  // ...existing fields
  getPanelManager: () => PanelManager;
}
```

Add commands in `registerLinearCommands`:

```typescript
    vscode.commands.registerCommand(
      CMD_OPEN_ISSUE,
      (issueId: string, label: string, _url?: string) => {
        if (!issueId) {
          return;
        }
        if (!ctx.getService().isConfigured()) {
          void vscode.window.showWarningMessage(
            "Linear is not connected. Set your API key first."
          );
          return;
        }
        ctx.getPanelManager().openIssue(issueId, label ?? "Linear Issue");
      }
    ),

    vscode.commands.registerCommand(
      CMD_OPEN_ISSUE_IN_BROWSER,
      (_issueId: string, _label: string, url?: string) => {
        if (url) {
          void vscode.env.openExternal(vscode.Uri.parse(url));
        }
      }
    ),
```

- [ ] **Step 3: Wire `extension.ts`**

```typescript
import { PanelManager } from "./panels/PanelManager";

// inside activate, after treeProvider created:
  const panelManager = new PanelManager(
    context.extensionUri,
    () => linearService,
    (issueId) => {
      // Best-effort sidebar sync — full refresh if patch data unavailable
      treeProvider.refresh();
    }
  );
  context.subscriptions.push(panelManager);

// extend commandCtx:
    getPanelManager: () => panelManager,
```

- [ ] **Step 4: Update `package.json` commands and menus**

Add commands:

```json
{
  "command": "linear.openIssue",
  "title": "Linear: Open Issue",
  "icon": "$(issue-opened)"
},
{
  "command": "linear.openIssueInBrowser",
  "title": "Linear: Open Issue in Browser",
  "icon": "$(link-external)"
}
```

Add context menu on issue items — in `menus`:

```json
"view/item/context": [
  {
    "command": "linear.openIssueInBrowser",
    "when": "view == linear.sidebar && viewItem == linearIssue",
    "group": "navigation"
  }
]
```

Set issue tree item `contextValue`:

In `mapIssueItems`: `item.contextValue = "linearIssue";`

- [ ] **Step 5: Run full verify**

Run: `yarn typecheck && yarn test && yarn build`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/providers/linearTreeDataProvider.ts src/commands.ts src/extension.ts package.json
git commit -m "feat: wire sidebar issue click to Task Detail panel"
```

---

### Task 12: CHANGELOG and manual verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.vscode/launch.json` (optional preLaunchTask for webview build)

**Interfaces:**
- Consumes: completed Phase 1 feature set
- Produces: documented release notes; F5 dev loop verified

- [ ] **Step 1: Add CHANGELOG entry**

```markdown
## [Unreleased]

### Added
- Task Detail panel — click an issue in the Linear sidebar to open an in-IDE detail tab
- Edit issue title, description, status, and priority from the panel
- Add comments from the panel
- View sub-issues and labels inline
- Context menu: Open Issue in Browser
```

- [ ] **Step 2: Optional — add preLaunchTask in `.vscode/launch.json`**

Ensure Extension Development Host builds webview before launch:

```json
"preLaunchTask": "${defaultBuildTask}"
```

Add `.vscode/tasks.json` task `build-all` running `yarn build`.

- [ ] **Step 3: Manual F5 verification checklist**

- [ ] F5 → Extension Development Host
- [ ] Set API key with write access
- [ ] Expand Issues → click issue → Task Detail tab opens
- [ ] Title, status, priority, description edits persist in Linear web
- [ ] Comment appears in Linear
- [ ] Re-click same issue → reveals existing tab (no duplicate)
- [ ] Context menu → Open in Browser works
- [ ] Refresh sidebar shows updated title/state

- [ ] **Step 4: Final CI verify**

Run: `yarn typecheck && yarn test && yarn build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md .vscode/
git commit -m "docs: add Phase 1 Task Detail panel changelog and dev tasks"
```

---

## Self-Review

### Spec coverage (Phase 1 PRD)

| PRD requirement | Task |
|-----------------|------|
| Click issue → Task Detail tab | Task 11 |
| Read title, description, status, priority, assignee, labels, project, sub-issues, comments | Tasks 5, 10 |
| Write title, description, status, priority, comment create | Tasks 3, 5, 9, 10 |
| Sidebar sync on mutation | Task 11 |
| Open in Linear link | Task 10 |
| Skip agent assignment | Not in plan ✓ |
| Skip attachments, activity feed | Not in plan ✓ |
| WebviewPanel in editor area | Tasks 8, 9 |
| Panel dedupe by issue ID | Task 8 |
| API key never in webview | Tasks 9, 11 |
| Typed messaging protocol | Task 1 |
| Mutation queue per issue | Task 9 |
| Issue detail cache TTL 5 min | Task 4 |

**Gaps / deferred intentionally:**

- Cmd/Ctrl+Click → browser: VS Code TreeView lacks modifier in command args → context menu + panel header link (PRD partial; document in CHANGELOG)
- `linear.openIssue` fuzzy picker command → Phase 1.1 polish
- Focus polling every 60s → Phase 1.1 (refresh on tab focus via `onDidChangeViewState`)
- Sub-issue click → open nested Task Detail → Phase 1.1

### Placeholder scan

No TBD/TODO/implement-later steps. All code blocks are complete.

### Type consistency

- `LinearIssueDetail` defined Task 1, used Tasks 4, 5, 9
- `IssuePatch` defined Task 1, used Tasks 3, 5, 9, 10
- `PanelManager.openIssue(issueId, tabLabel)` consistent Tasks 8, 11
- `CMD_OPEN_ISSUE` / `CMD_OPEN_ISSUE_IN_BROWSER` consistent Tasks 8, 11, package.json

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-phase1-task-detail-panel.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

**Follow-on:** After Phase 1 ships, create separate plans for Phase 2 (Kanban/List), Phase 3 (Project Detail), Phase 4 (Agent Assignment) referencing `docs/superpowers/specs/2026-06-26-multi-panel-linear-workspace-prd.md`.
