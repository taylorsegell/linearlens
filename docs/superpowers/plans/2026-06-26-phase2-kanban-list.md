# Phase 2 — Kanban / List Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of the multi-panel Linear workspace — project-scoped **Kanban** and **List** boards in editor-area webview tabs with drag-drop status changes, filters (status, label, assignee), phase-label swimlane grouping, virtualized scrolling, and click-to-open Task Detail.

**Architecture:** Extend Phase 1's `PanelManager` + shared React webview bundle. Add `KanbanBoardPanel` keyed by `board:{projectId}`. Pure modules under `src/linear/` handle board issue mapping, client-side filtering/grouping, and paginated project-scoped fetch via `@linear/sdk` in the extension host. Webview receives panel bootstrap via injected JSON; `@dnd-kit/core` for drag-drop; `react-window` for virtualization. Board filter/view state persists in `workspaceState` per project. Interim navigation opens boards from project sidebar click + command until Phase 3 Project Detail ships.

**Tech Stack:** TypeScript 5.x (strict), Vitest 3, esbuild (extension host), Vite 6 + React 19 (webview UI), `@linear/sdk` ^87, `@dnd-kit/core` ^6, `@dnd-kit/utilities` ^3, `react-window` ^1.8, VS Code Extension API `^1.96.0`, Yarn

## Global Constraints

- Auth provider id stays `"linear"` — do not rename.
- Secret storage key stays `"linear.auth"` (OAuth sessions).
- Sidebar API key secret stays `"linear.apiKey"`.
- OAuth redirect URI stays `${vscode.env.uriScheme}://linear.linear-connect/callback`.
- Engine floor: `"vscode": "^1.96.0"`.
- API key / OAuth token **never** passed to webview — all Linear calls in extension host.
- Phase 2 **skips:** bulk edit, WIP limits, milestone swimlanes, agent badges/filter, Project Detail panel.
- Issue milestone SDK field is `projectMilestone`, not `milestone`.
- Vite asset paths in `getWebviewHtml.ts` regex expect `/assets/…` (Vite 6).
- Webview bundle target: **< 500 KB gzipped** (Phase 1 ~62 KB; budget ~150 KB after DnD + virtualization).
- Verify before finishing each task batch: `yarn typecheck && yarn test && yarn esbuild && yarn build:webview`.
- Do not commit unless explicitly requested by user.
- Minimize diffs to Phase 1 OAuth provider and Task Detail behavior.

**Interim navigation (Phase 3 deferred):** Primary project sidebar click → open board tab. Context menu → Open in Browser. Command `linear.openProjectBoard` → QuickPick. Phase 3 will change primary click to Project Detail; board opens via modifier/context.

**Follow-on plans (not this document):** Phase 3 Project Detail, Phase 4 Agent Assignment.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/linear/types.ts` | Add `LinearBoardIssueCard`, `LinearProjectBoardMeta`, `BoardIssuesPage` |
| `src/linear/boardIssueMapper.ts` | Pure SDK-shaped input → `LinearBoardIssueCard` (unit tested) |
| `src/linear/boardFilters.ts` | Filter/group/sort pure functions + phase label extraction (unit tested) |
| `src/linear/boardViewState.ts` | Load/save `BoardViewState` per project in `workspaceState` (unit tested) |
| `src/linear/boardCache.ts` | TTL cache + pagination cursors per project |
| `src/linear/linearClient.ts` | Add `fetchProjectBoardMeta`, `fetchProjectBoardPage` |
| `src/webview/messaging.ts` | Extend protocol: `moveIssue`, `loadBoardPage`, board extension messages |
| `src/panels/getWebviewHtml.ts` | Generalize to inject panel bootstrap JSON |
| `src/panels/KanbanBoardPanel.ts` | WebviewPanel lifecycle + board message routing |
| `src/panels/PanelManager.ts` | Add `openBoard(projectId, label)` + `onOpenIssue` callback wiring |
| `src/panels/IssueDetailPanel.ts` | Pass bootstrap `{ panel: "issue", issueId }` to HTML loader |
| `src/config.ts` | Add `CMD_OPEN_PROJECT_BOARD`, `CMD_OPEN_PROJECT_IN_BROWSER` |
| `src/commands.ts` | Register board commands + QuickPick |
| `src/providers/linearTreeDataProvider.ts` | Project click → board; context menu browser |
| `src/extension.ts` | Pass `onOpenIssue` between panels via `PanelManager` |
| `webview-ui/src/bootstrap.ts` | Read `window.__LINEAR_PANEL__` bootstrap |
| `webview-ui/src/App.tsx` | Route to Issue Detail or Board by bootstrap |
| `webview-ui/src/hooks/useBoardMessaging.ts` | Board webview ↔ extension bridge |
| `webview-ui/src/components/board/` | KanbanBoardView, ListBoardView, BoardToolbar, IssueCard |
| `webview-ui/src/styles.css` | Board layout + swimlane styles |
| `package.json` | New commands, settings, deps |
| `CHANGELOG.md` | Phase 2 user-visible notes |

**DnD choice:** `@dnd-kit/core` — accessible, webview-safe, ~30 KB gzipped vs brittle HTML5 DnD in Electron webviews.

**Virtualization choice:** `react-window` `FixedSizeList` per column/row — ~6 KB gzipped, sufficient for 200+ cards.

**Pagination strategy:** Unified project-scoped fetch (50/page, cursor-based). Client assigns issues to status columns. Infinite scroll / "Load more" appends pages. Filters/search apply client-side to loaded issues (prefetch all pages on first load when project has ≤200 issues; show load-more beyond that).

---

### Task 1: Board types and messaging protocol

**Files:**
- Modify: `src/linear/types.ts`
- Modify: `src/webview/messaging.ts`
- Modify: `src/test/messaging.test.ts`

**Interfaces:**
- Consumes: existing `LinearWorkflowState`, `LinearIssueDetail` from Phase 1
- Produces:
  - `LinearBoardIssueCard`, `LinearProjectBoardMeta`, `BoardIssuesPage`, `BoardViewState`, `BoardFilters`, `BoardGroupBy`, `ListSortKey` in `types.ts`
  - Extended `WebviewRequest`, `ExtensionMessage`, updated `isWebviewRequest` in `messaging.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/test/messaging.test.ts`:

```typescript
  it("accepts moveIssue", () => {
    const msg: WebviewRequest = {
      type: "moveIssue",
      issueId: "issue-1",
      stateId: "state-2",
      projectId: "proj-1",
    };
    expect(isWebviewRequest(msg)).toBe(true);
  });

  it("accepts openIssue from board", () => {
    const msg: WebviewRequest = {
      type: "openIssue",
      issueId: "issue-1",
      label: "ABO-1: Fix auth",
    };
    expect(isWebviewRequest(msg)).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/messaging.test.ts`
Expected: FAIL — `moveIssue` not accepted by type guard

- [ ] **Step 3: Add board types to `src/linear/types.ts`**

```typescript
/** Lightweight issue card for Kanban/List boards. */
export interface LinearBoardIssueCard {
  id: string;
  identifier: string;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  priority: number;
  priorityLabel: string;
  state: LinearWorkflowState;
  assignee?: { id: string; name: string };
  labels: { id: string; name: string; color?: string }[];
  milestone?: { id: string; name: string };
}

/** Project metadata needed to render a board header. */
export interface LinearProjectBoardMeta {
  id: string;
  name: string;
  url: string;
  teamId: string;
  progress: number;
}

/** Paginated project issues page. */
export interface BoardIssuesPage {
  issues: LinearBoardIssueCard[];
  hasNextPage: boolean;
  endCursor?: string;
}

export type BoardGroupBy = "none" | "phaseLabel" | "assignee";
export type BoardViewMode = "kanban" | "list";
export type ListSortKey = "priority" | "updatedAt" | "createdAt" | "identifier";

export interface BoardFilters {
  statusIds: string[];
  labelIds: string[];
  assigneeIds: Array<string | "__unassigned__">;
  search: string;
}

export interface BoardViewState {
  view: BoardViewMode;
  groupBy: BoardGroupBy;
  filters: BoardFilters;
  sortBy: ListSortKey;
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  statusIds: [],
  labelIds: [],
  assigneeIds: [],
  search: "",
};

export const DEFAULT_BOARD_VIEW_STATE: BoardViewState = {
  view: "kanban",
  groupBy: "phaseLabel",
  filters: DEFAULT_BOARD_FILTERS,
  sortBy: "priority",
};

/** Swimlane row when groupBy !== "none". */
export interface BoardSwimlane {
  id: string;
  label: string;
  issues: LinearBoardIssueCard[];
}
```

- [ ] **Step 4: Extend `src/webview/messaging.ts`**

Add imports:

```typescript
import type {
  LinearBoardIssueCard,
  LinearProjectBoardMeta,
  BoardIssuesPage,
  BoardViewState,
} from "../linear/types";
```

Extend types:

```typescript
/** webview → extension host */
export type WebviewRequest =
  | { type: "ready" }
  | { type: "refresh"; issueId: string }
  | { type: "updateIssue"; issueId: string; patch: IssuePatch }
  | { type: "createComment"; issueId: string; body: string }
  | { type: "openExternal"; url: string }
  | { type: "openIssue"; issueId: string; label: string }
  | {
      type: "moveIssue";
      issueId: string;
      stateId: string;
      projectId: string;
    }
  | { type: "loadBoardPage"; projectId: string; cursor?: string }
  | { type: "saveBoardViewState"; projectId: string; viewState: BoardViewState }
  | { type: "refreshBoard"; projectId: string };

/** extension host → webview */
export type ExtensionMessage =
  | {
      type: "issueLoaded";
      issue: LinearIssueDetail;
      workflowStates: WorkflowStateOption[];
    }
  | { type: "issueUpdated"; issue: LinearIssueDetail }
  | {
      type: "boardLoaded";
      meta: LinearProjectBoardMeta;
      workflowStates: WorkflowStateOption[];
      viewState: BoardViewState;
      page: BoardIssuesPage;
    }
  | {
      type: "boardPageLoaded";
      page: BoardIssuesPage;
      append: boolean;
    }
  | { type: "boardIssueUpdated"; issue: LinearBoardIssueCard }
  | {
      type: "boardMoveFailed";
      issueId: string;
      previousStateId: string;
      message: string;
    }
  | { type: "mutationError"; message: string }
  | { type: "theme"; kind: "light" | "dark" | "highContrast" };

export interface WebviewPanelBootstrap {
  panel: "issue" | "board";
  issueId?: string;
  projectId?: string;
}
```

Update `isWebviewRequest`:

```typescript
  return (
    type === "ready" ||
    type === "refresh" ||
    type === "updateIssue" ||
    type === "createComment" ||
    type === "openExternal" ||
    type === "openIssue" ||
    type === "moveIssue" ||
    type === "loadBoardPage" ||
    type === "saveBoardViewState" ||
    type === "refreshBoard"
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/test/messaging.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/linear/types.ts src/webview/messaging.ts src/test/messaging.test.ts
git commit -m "feat: add board types and extend webview messaging protocol"
```

---

### Task 2: Board issue mapper (pure, testable)

**Files:**
- Create: `src/linear/boardIssueMapper.ts`
- Test: `src/test/boardIssueMapper.test.ts`

**Interfaces:**
- Consumes: `LinearBoardIssueCard`, `LinearWorkflowState` from Task 1
- Produces: `mapBoardIssue(input: RawBoardIssueInput): LinearBoardIssueCard`

- [ ] **Step 1: Write the failing test**

Create `src/test/boardIssueMapper.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapBoardIssue } from "../linear/boardIssueMapper";

describe("mapBoardIssue", () => {
  it("maps card fields including labels and milestone", () => {
    const card = mapBoardIssue({
      id: "i1",
      identifier: "ABO-42",
      title: "Kanban card",
      url: "https://linear.app/x/ABO-42",
      updatedAt: "2026-06-26T12:00:00.000Z",
      createdAt: "2026-06-25T12:00:00.000Z",
      priority: 2,
      priorityLabel: "High",
      state: { id: "s1", name: "In Progress", type: "started", color: "#f00" },
      assignee: { id: "u1", name: "Alex" },
      labels: [{ id: "l1", name: "phase-2", color: "#0f0" }],
      milestone: { id: "m1", name: "Phase 2 API" },
    });

    expect(card.identifier).toBe("ABO-42");
    expect(card.labels[0].name).toBe("phase-2");
    expect(card.milestone?.name).toBe("Phase 2 API");
    expect(card.state.name).toBe("In Progress");
  });

  it("defaults missing optional fields", () => {
    const card = mapBoardIssue({
      id: "i2",
      identifier: "ABO-99",
      title: "Minimal",
      url: "https://linear.app/x",
      updatedAt: "2026-06-26T12:00:00.000Z",
      createdAt: "2026-06-26T12:00:00.000Z",
      priority: 0,
      priorityLabel: "No priority",
      state: { id: "s2", name: "Backlog", type: "backlog", color: "#999" },
    });

    expect(card.labels).toEqual([]);
    expect(card.assignee).toBeUndefined();
    expect(card.milestone).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/boardIssueMapper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/linear/boardIssueMapper.ts`**

```typescript
import type { LinearBoardIssueCard, LinearWorkflowState } from "./types";

export interface RawBoardIssueInput {
  id: string;
  identifier: string;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  priority: number;
  priorityLabel: string;
  state: LinearWorkflowState;
  assignee?: { id: string; name: string };
  labels?: { id: string; name: string; color?: string }[];
  milestone?: { id: string; name: string };
}

export function mapBoardIssue(input: RawBoardIssueInput): LinearBoardIssueCard {
  return {
    id: input.id,
    identifier: input.identifier,
    title: input.title,
    url: input.url,
    updatedAt: input.updatedAt,
    createdAt: input.createdAt,
    priority: input.priority,
    priorityLabel: input.priorityLabel,
    state: input.state,
    assignee: input.assignee,
    labels: input.labels ?? [],
    milestone: input.milestone,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/boardIssueMapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/linear/boardIssueMapper.ts src/test/boardIssueMapper.test.ts
git commit -m "feat: add pure board issue mapper"
```

---

### Task 3: Board filters, grouping, and view-state persistence

**Files:**
- Create: `src/linear/boardFilters.ts`
- Create: `src/linear/boardViewState.ts`
- Test: `src/test/boardFilters.test.ts`
- Test: `src/test/boardViewState.test.ts`

**Interfaces:**
- Consumes: `LinearBoardIssueCard`, `BoardFilters`, `BoardGroupBy`, `BoardViewState`, `BoardSwimlane` from Task 1
- Produces:
  - `extractPhaseLabel(labels, prefix): string | null`
  - `applyBoardFilters(issues, filters): LinearBoardIssueCard[]`
  - `groupIssuesIntoSwimlanes(issues, groupBy, phasePrefix): BoardSwimlane[]`
  - `sortIssuesForList(issues, sortBy): LinearBoardIssueCard[]`
  - `loadBoardViewState(workspaceState, projectId): BoardViewState`
  - `saveBoardViewState(workspaceState, projectId, viewState): Promise<void>`

- [ ] **Step 1: Write the failing filter/group test**

Create `src/test/boardFilters.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  applyBoardFilters,
  extractPhaseLabel,
  groupIssuesIntoSwimlanes,
  sortIssuesForList,
} from "../linear/boardFilters";
import type { LinearBoardIssueCard } from "../linear/types";

const baseState = {
  id: "s1",
  name: "Todo",
  type: "unstarted",
  color: "#ccc",
};

function card(
  overrides: Partial<LinearBoardIssueCard> & { id: string }
): LinearBoardIssueCard {
  return {
    identifier: overrides.id.toUpperCase(),
    title: "Issue",
    url: "https://linear.app/x",
    updatedAt: "2026-06-26T00:00:00.000Z",
    createdAt: "2026-06-25T00:00:00.000Z",
    priority: 2,
    priorityLabel: "High",
    state: baseState,
    labels: [],
    ...overrides,
  };
}

describe("extractPhaseLabel", () => {
  it("returns first label matching prefix", () => {
    expect(
      extractPhaseLabel(
        [{ name: "bug" }, { name: "phase-2" }, { name: "phase-1" }],
        "phase-"
      )
    ).toBe("phase-2");
  });

  it("returns null when no match", () => {
    expect(extractPhaseLabel([{ name: "bug" }], "phase-")).toBeNull();
  });
});

describe("applyBoardFilters", () => {
  it("filters by status, label, assignee, and search", () => {
    const issues = [
      card({
        id: "1",
        title: "Auth setup",
        state: { ...baseState, id: "s1" },
        labels: [{ id: "l1", name: "phase-1", color: "#0f0" }],
        assignee: { id: "u1", name: "Alex" },
      }),
      card({
        id: "2",
        title: "Deploy",
        state: { ...baseState, id: "s2", name: "Done" },
        labels: [{ id: "l2", name: "phase-2", color: "#00f" }],
      }),
    ];

    const filtered = applyBoardFilters(issues, {
      statusIds: ["s1"],
      labelIds: ["l1"],
      assigneeIds: ["u1"],
      search: "auth",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });
});

describe("groupIssuesIntoSwimlanes", () => {
  it("groups by phase label with fallback lane", () => {
    const issues = [
      card({
        id: "1",
        labels: [{ id: "l1", name: "phase-1", color: "#0f0" }],
      }),
      card({ id: "2", labels: [] }),
    ];

    const lanes = groupIssuesIntoSwimlanes(issues, "phaseLabel", "phase-");
    expect(lanes.map((l) => l.label).sort()).toEqual(
      ["No phase", "phase-1"].sort()
    );
  });

  it("returns single lane when groupBy is none", () => {
    const issues = [card({ id: "1" }), card({ id: "2" })];
    const lanes = groupIssuesIntoSwimlanes(issues, "none", "phase-");
    expect(lanes).toHaveLength(1);
    expect(lanes[0].id).toBe("all");
    expect(lanes[0].issues).toHaveLength(2);
  });
});

describe("sortIssuesForList", () => {
  it("sorts by priority ascending (P0 first)", () => {
    const issues = [
      card({ id: "1", priority: 3 }),
      card({ id: "2", priority: 1 }),
    ];
    const sorted = sortIssuesForList(issues, "priority");
    expect(sorted.map((i) => i.id)).toEqual(["2", "1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/boardFilters.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/linear/boardFilters.ts`**

```typescript
import type {
  BoardFilters,
  BoardGroupBy,
  BoardSwimlane,
  LinearBoardIssueCard,
  ListSortKey,
} from "./types";

export function extractPhaseLabel(
  labels: { name: string }[],
  prefix: string
): string | null {
  const match = labels.find((label) =>
    label.name.toLowerCase().startsWith(prefix.toLowerCase())
  );
  return match?.name ?? null;
}

export function applyBoardFilters(
  issues: LinearBoardIssueCard[],
  filters: BoardFilters
): LinearBoardIssueCard[] {
  const search = filters.search.trim().toLowerCase();

  return issues.filter((issue) => {
    if (
      filters.statusIds.length > 0 &&
      !filters.statusIds.includes(issue.state.id)
    ) {
      return false;
    }

    if (filters.labelIds.length > 0) {
      const issueLabelIds = new Set(issue.labels.map((l) => l.id));
      const hasLabel = filters.labelIds.some((id) => issueLabelIds.has(id));
      if (!hasLabel) {
        return false;
      }
    }

    if (filters.assigneeIds.length > 0) {
      const wantsUnassigned = filters.assigneeIds.includes("__unassigned__");
      const assigneeId = issue.assignee?.id;
      const matchesAssignee =
        assigneeId !== undefined &&
        filters.assigneeIds.includes(assigneeId);
      if (!matchesAssignee && !(wantsUnassigned && !assigneeId)) {
        return false;
      }
    }

    if (search) {
      const haystack = `${issue.identifier} ${issue.title}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

export function groupIssuesIntoSwimlanes(
  issues: LinearBoardIssueCard[],
  groupBy: BoardGroupBy,
  phasePrefix: string
): BoardSwimlane[] {
  if (groupBy === "none") {
    return [{ id: "all", label: "All issues", issues }];
  }

  const laneMap = new Map<string, BoardSwimlane>();

  for (const issue of issues) {
    let laneId: string;
    let laneLabel: string;

    if (groupBy === "phaseLabel") {
      const phase = extractPhaseLabel(issue.labels, phasePrefix);
      laneId = phase ?? "__no_phase__";
      laneLabel = phase ?? "No phase";
    } else {
      laneId = issue.assignee?.id ?? "__unassigned__";
      laneLabel = issue.assignee?.name ?? "Unassigned";
    }

    const existing = laneMap.get(laneId);
    if (existing) {
      existing.issues.push(issue);
    } else {
      laneMap.set(laneId, { id: laneId, label: laneLabel, issues: [issue] });
    }
  }

  return Array.from(laneMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

export function sortIssuesForList(
  issues: LinearBoardIssueCard[],
  sortBy: ListSortKey
): LinearBoardIssueCard[] {
  const copy = [...issues];

  copy.sort((a, b) => {
    switch (sortBy) {
      case "priority":
        return a.priority - b.priority;
      case "updatedAt":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "createdAt":
        return b.createdAt.localeCompare(a.createdAt);
      case "identifier":
        return a.identifier.localeCompare(b.identifier);
      default:
        return 0;
    }
  });

  return copy;
}
```

- [ ] **Step 4: Write view-state persistence test**

Create `src/test/boardViewState.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  boardViewStateKey,
  loadBoardViewState,
  saveBoardViewState,
} from "../linear/boardViewState";
import { DEFAULT_BOARD_VIEW_STATE } from "../linear/types";

describe("boardViewState", () => {
  it("loads defaults when nothing stored", () => {
    const memento = { get: () => undefined, update: async () => undefined };
    expect(loadBoardViewState(memento, "proj-1")).toEqual(
      DEFAULT_BOARD_VIEW_STATE
    );
  });

  it("round-trips saved state", async () => {
    let stored: unknown;
    const memento = {
      get: (key: string) => (key === boardViewStateKey("proj-1") ? stored : undefined),
      update: async (_key: string, value: unknown) => {
        stored = value;
      },
    };

    const custom = {
      ...DEFAULT_BOARD_VIEW_STATE,
      view: "list" as const,
      groupBy: "none" as const,
    };
    await saveBoardViewState(memento, "proj-1", custom);
    expect(loadBoardViewState(memento, "proj-1")).toEqual(custom);
  });
});
```

- [ ] **Step 5: Implement `src/linear/boardViewState.ts`**

```typescript
import type * as vscode from "vscode";
import {
  DEFAULT_BOARD_VIEW_STATE,
  type BoardViewState,
} from "./types";

export function boardViewStateKey(projectId: string): string {
  return `linear.boardViewState.${projectId}`;
}

export function loadBoardViewState(
  workspaceState: vscode.Memento,
  projectId: string
): BoardViewState {
  return (
    workspaceState.get<BoardViewState>(boardViewStateKey(projectId)) ?? {
      ...DEFAULT_BOARD_VIEW_STATE,
      filters: { ...DEFAULT_BOARD_VIEW_STATE.filters },
    }
  );
}

export async function saveBoardViewState(
  workspaceState: vscode.Memento,
  projectId: string,
  viewState: BoardViewState
): Promise<void> {
  await workspaceState.update(boardViewStateKey(projectId), viewState);
}
```

- [ ] **Step 6: Run tests**

Run: `yarn test src/test/boardFilters.test.ts src/test/boardViewState.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/linear/boardFilters.ts src/linear/boardViewState.ts src/test/boardFilters.test.ts src/test/boardViewState.test.ts
git commit -m "feat: add board filter, grouping, and view-state helpers"
```

---

### Task 4: Board cache with pagination cursors

**Files:**
- Create: `src/linear/boardCache.ts`
- Test: `src/test/boardCache.test.ts`

**Interfaces:**
- Consumes: `LinearBoardIssueCard`, `BoardIssuesPage` from Task 1
- Produces:
  - `class BoardCache` with `getIssues(projectId)`, `appendPage(projectId, page)`, `patchIssue(projectId, issue)`, `invalidate(projectId)`, `getCursor(projectId)`, `TTL_MS = 5 * 60 * 1000`

- [ ] **Step 1: Write the failing test**

Create `src/test/boardCache.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BoardCache } from "../linear/boardCache";
import type { LinearBoardIssueCard } from "../linear/types";

const state = {
  id: "s1",
  name: "Todo",
  type: "unstarted",
  color: "#ccc",
};

const issue = (id: string): LinearBoardIssueCard => ({
  id,
  identifier: id.toUpperCase(),
  title: "Test",
  url: "https://linear.app/x",
  updatedAt: "2026-06-26T00:00:00.000Z",
  createdAt: "2026-06-25T00:00:00.000Z",
  priority: 1,
  priorityLabel: "Urgent",
  state,
  labels: [],
});

describe("BoardCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("appends pages and tracks cursor", () => {
    const cache = new BoardCache();
    cache.appendPage("p1", {
      issues: [issue("1")],
      hasNextPage: true,
      endCursor: "cursor-1",
    });
    cache.appendPage(
      "p1",
      { issues: [issue("2")], hasNextPage: false },
      { append: true }
    );

    expect(cache.getIssues("p1")).toHaveLength(2);
    expect(cache.getCursor("p1")).toBeUndefined();
  });

  it("patches a single issue in place", () => {
    const cache = new BoardCache();
    cache.appendPage("p1", { issues: [issue("1")], hasNextPage: false });
    cache.patchIssue("p1", { ...issue("1"), title: "Updated" });
    expect(cache.getIssues("p1")[0].title).toBe("Updated");
  });

  it("invalidates after TTL", () => {
    const cache = new BoardCache();
    cache.appendPage("p1", { issues: [issue("1")], hasNextPage: false });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(cache.getIssues("p1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/boardCache.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/linear/boardCache.ts`**

```typescript
import type { BoardIssuesPage, LinearBoardIssueCard } from "./types";

export const BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

interface BoardCacheEntry {
  issues: LinearBoardIssueCard[];
  endCursor?: string;
  hasNextPage: boolean;
  fetchedAt: number;
}

export class BoardCache {
  private readonly entries = new Map<string, BoardCacheEntry>();

  private getEntry(projectId: string): BoardCacheEntry | undefined {
    const entry = this.entries.get(projectId);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > BOARD_CACHE_TTL_MS) {
      this.entries.delete(projectId);
      return undefined;
    }
    return entry;
  }

  getIssues(projectId: string): LinearBoardIssueCard[] {
    return this.getEntry(projectId)?.issues ?? [];
  }

  getCursor(projectId: string): string | undefined {
    const entry = this.getEntry(projectId);
    return entry?.hasNextPage ? entry.endCursor : undefined;
  }

  hasNextPage(projectId: string): boolean {
    return this.getEntry(projectId)?.hasNextPage ?? false;
  }

  appendPage(
    projectId: string,
    page: BoardIssuesPage,
    options?: { append?: boolean }
  ): void {
    const existing = this.getEntry(projectId);
    const append = options?.append ?? false;

    const issues = append
      ? [...(existing?.issues ?? []), ...page.issues]
      : page.issues;

    this.entries.set(projectId, {
      issues,
      endCursor: page.endCursor,
      hasNextPage: page.hasNextPage,
      fetchedAt: Date.now(),
    });
  }

  patchIssue(projectId: string, issue: LinearBoardIssueCard): void {
    const entry = this.getEntry(projectId);
    if (!entry) {
      return;
    }
    entry.issues = entry.issues.map((existing) =>
      existing.id === issue.id ? issue : existing
    );
  }

  invalidate(projectId: string): void {
    this.entries.delete(projectId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/boardCache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/linear/boardCache.ts src/test/boardCache.test.ts
git commit -m "feat: add board cache with pagination and TTL"
```

---

### Task 5: LinearService — project board fetch

**Files:**
- Modify: `src/linear/linearClient.ts`
- Test: `src/test/linearClientBoard.test.ts`

**Interfaces:**
- Consumes: `mapBoardIssue`, `LinearProjectBoardMeta`, `BoardIssuesPage` from Tasks 1–2
- Produces on `LinearService`:
  - `fetchProjectBoardMeta(projectId: string): Promise<LinearProjectBoardMeta>`
  - `fetchProjectBoardPage(projectId: string, cursor?: string, pageSize?: number): Promise<BoardIssuesPage>`

- [ ] **Step 1: Write the failing test**

Create `src/test/linearClientBoard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinearService } from "../linear/linearClient";

function makeBoardIssueMock(id: string) {
  return {
    id,
    identifier: `ABO-${id}`,
    title: `Issue ${id}`,
    url: `https://linear.app/x/ABO-${id}`,
    updatedAt: new Date("2026-06-26T12:00:00.000Z"),
    createdAt: new Date("2026-06-25T12:00:00.000Z"),
    priority: 2,
    priorityLabel: "High",
    state: Promise.resolve({
      id: "state-1",
      name: "In Progress",
      type: "started",
      color: "#ff0000",
    }),
    assignee: Promise.resolve({ id: "u1", displayName: "Alex" }),
    projectMilestone: Promise.resolve({ id: "m1", name: "Phase 2" }),
    labels: vi.fn(async () => ({
      nodes: [{ id: "l1", name: "phase-2", color: "#00ff00" }],
    })),
  };
}

describe("LinearService board fetch", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetchProjectBoardPage maps issues with pagination", async () => {
    const service = new LinearService("lin_api_test");
    const issueMock = makeBoardIssueMock("1");

    (service as unknown as {
      client: {
        project: (id: string) => Promise<{
          id: string;
          name: string;
          url: string;
          progress: number;
          teams: () => Promise<{ nodes: { id: string }[] }>;
          issues: (args: unknown) => Promise<{
            nodes: unknown[];
            pageInfo: { hasNextPage: boolean; endCursor?: string };
          }>;
        }>;
      };
    }).client = {
      project: vi.fn(async () => ({
        id: "proj-1",
        name: "Abodi Beta",
        url: "https://linear.app/x/project/abodi",
        progress: 0.62,
        teams: vi.fn(async () => ({ nodes: [{ id: "team-1" }] })),
        issues: vi.fn(async () => ({
          nodes: [issueMock],
          pageInfo: { hasNextPage: true, endCursor: "cursor-abc" },
        })),
      })),
    };

    const page = await service.fetchProjectBoardPage("proj-1");
    expect(page.issues).toHaveLength(1);
    expect(page.issues[0].identifier).toBe("ABO-1");
    expect(page.issues[0].labels[0].name).toBe("phase-2");
    expect(page.hasNextPage).toBe(true);
    expect(page.endCursor).toBe("cursor-abc");
  });

  it("fetchProjectBoardMeta returns teamId", async () => {
    const service = new LinearService("lin_api_test");

    (service as unknown as {
      client: {
        project: (id: string) => Promise<{
          id: string;
          name: string;
          url: string;
          progress: number;
          teams: () => Promise<{ nodes: { id: string }[] }>;
        }>;
      };
    }).client = {
      project: vi.fn(async () => ({
        id: "proj-1",
        name: "Abodi Beta",
        url: "https://linear.app/x/project/abodi",
        progress: 0.62,
        teams: vi.fn(async () => ({ nodes: [{ id: "team-1" }] })),
      })),
    };

    const meta = await service.fetchProjectBoardMeta("proj-1");
    expect(meta.teamId).toBe("team-1");
    expect(meta.name).toBe("Abodi Beta");
    expect(meta.progress).toBe(62);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/test/linearClientBoard.test.ts`
Expected: FAIL — methods not defined

- [ ] **Step 3: Add methods to `src/linear/linearClient.ts`**

Add imports:

```typescript
import { mapBoardIssue } from "./boardIssueMapper";
import type {
  BoardIssuesPage,
  LinearProjectBoardMeta,
} from "./types";
```

Add constant near `PAGE_SIZE`:

```typescript
const BOARD_PAGE_SIZE = 50;
```

Add private helper and public methods:

```typescript
  private async mapBoardIssueNode(
    issue: Awaited<ReturnType<LinearClient["issue"]>>
  ) {
    const [state, assignee, projectMilestone, labelsConnection] =
      await Promise.all([
        issue.state,
        issue.assignee,
        issue.projectMilestone,
        issue.labels(),
      ]);

    if (!state) {
      throw new Error(`Issue ${issue.id} is missing workflow state.`);
    }

    return mapBoardIssue({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      updatedAt: issue.updatedAt.toISOString(),
      createdAt: issue.createdAt.toISOString(),
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      state: {
        id: state.id,
        name: state.name,
        type: state.type,
        color: state.color,
      },
      assignee: assignee
        ? {
            id: assignee.id,
            name: assignee.displayName ?? assignee.name,
          }
        : undefined,
      labels: labelsConnection.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      milestone: projectMilestone
        ? { id: projectMilestone.id, name: projectMilestone.name }
        : undefined,
    });
  }

  async fetchProjectBoardMeta(
    projectId: string
  ): Promise<LinearProjectBoardMeta> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const project = await this.client.project(projectId);
    const teamsConnection = await project.teams();
    const team = teamsConnection.nodes[0];
    if (!team) {
      throw new Error("Project has no linked team.");
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      teamId: team.id,
      progress: progressPercent(project.progress) ?? 0,
    };
  }

  async fetchProjectBoardPage(
    projectId: string,
    cursor?: string,
    pageSize: number = BOARD_PAGE_SIZE
  ): Promise<BoardIssuesPage> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const project = await this.client.project(projectId);
    const connection = await project.issues({
      first: pageSize,
      after: cursor,
    });

    const issues = await Promise.all(
      connection.nodes.map((issue) => this.mapBoardIssueNode(issue))
    );

    return {
      issues,
      hasNextPage: connection.pageInfo.hasNextPage,
      endCursor: connection.pageInfo.endCursor ?? undefined,
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/test/linearClientBoard.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `yarn typecheck && yarn test`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/linear/linearClient.ts src/test/linearClientBoard.test.ts
git commit -m "feat: add project-scoped board fetch to LinearService"
```

---

### Task 6: Generalize webview HTML loader with panel bootstrap

**Files:**
- Modify: `src/panels/getWebviewHtml.ts`
- Modify: `src/panels/IssueDetailPanel.ts`
- Modify: `src/test/getWebviewHtml.test.ts`

**Interfaces:**
- Consumes: `WebviewPanelBootstrap` from `messaging.ts`
- Produces: `getWebviewHtml(webview, extensionUri, nonce, bootstrap): string` (rename from `getIssueDetailWebviewHtml`)

- [ ] **Step 1: Update test**

In `src/test/getWebviewHtml.test.ts`, rename import and add bootstrap assertion:

```typescript
    const html = getWebviewHtml(
      /* webview shim */,
      extensionUri,
      "test-nonce-123",
      { panel: "board", projectId: "proj-1" }
    );

    expect(html).toContain("test-nonce-123");
    expect(html).toContain("__LINEAR_PANEL__");
    expect(html).toContain('"panel":"board"');
```

- [ ] **Step 2: Implement generalized loader**

Replace `getIssueDetailWebviewHtml` in `src/panels/getWebviewHtml.ts`:

```typescript
import type { WebviewPanelBootstrap } from "../webview/messaging";

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string,
  bootstrap: WebviewPanelBootstrap
): string {
  const distDir = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const indexPath = vscode.Uri.joinPath(distDir, "index.html");
  const htmlOnDisk = fs.readFileSync(indexPath.fsPath, "utf8");

  const scriptMatch = htmlOnDisk.match(/src="[^"]*\/assets\/([^"]+\.js)"/);
  const styleMatch = htmlOnDisk.match(/href="[^"]*\/assets\/([^"]+\.css)"/);

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

  const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, "\\u003c");

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
  <title>Linear</title>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__LINEAR_PANEL__ = ${bootstrapJson};
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

/** @deprecated Use getWebviewHtml */
export function getIssueDetailWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  return getWebviewHtml(webview, extensionUri, nonce, {
    panel: "issue",
  });
}
```

- [ ] **Step 3: Update `IssueDetailPanel.ts`**

Replace HTML call:

```typescript
import { getWebviewHtml } from "./getWebviewHtml";

// in create():
    panel.webview.html = getWebviewHtml(
      panel.webview,
      extensionUri,
      nonce,
      { panel: "issue", issueId }
    );
```

- [ ] **Step 4: Run build + test**

Run: `yarn build:webview && yarn test src/test/getWebviewHtml.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/panels/getWebviewHtml.ts src/panels/IssueDetailPanel.ts src/test/getWebviewHtml.test.ts
git commit -m "feat: generalize webview HTML loader with panel bootstrap"
```

---

### Task 7: KanbanBoardPanel (extension host controller)

**Files:**
- Create: `src/panels/KanbanBoardPanel.ts`

**Interfaces:**
- Consumes: `getWebviewHtml`, `BoardCache`, `LinearService`, `loadBoardViewState`, `saveBoardViewState`, messaging types
- Produces: `KanbanBoardPanel.create(...)` handling board messages; calls `onOpenIssue(issueId, label)` and `onIssueUpdated(issueId)` callbacks

- [ ] **Step 1: Create `src/panels/KanbanBoardPanel.ts`**

```typescript
import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { LinearService } from "../linear/linearClient";
import { BoardCache } from "../linear/boardCache";
import {
  loadBoardViewState,
  saveBoardViewState,
} from "../linear/boardViewState";
import { getWebviewHtml } from "./getWebviewHtml";
import {
  isWebviewRequest,
  type ExtensionMessage,
} from "../webview/messaging";
import type { LinearBoardIssueCard } from "../linear/types";

const cache = new BoardCache();

export class KanbanBoardPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly mutationQueues = new Map<string, Promise<void>>();

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly getService: () => LinearService,
    private readonly workspaceState: vscode.Memento,
    private readonly projectId: string,
    private readonly onOpenIssue: (issueId: string, label: string) => void,
    private readonly onIssueUpdated: (issueId: string) => void,
    private readonly onDisposeCallback: () => void
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => void this.handleMessage(msg),
      null,
      this.disposables
    );
    void this.loadBoard();
  }

  static create(
    extensionUri: vscode.Uri,
    getService: () => LinearService,
    workspaceState: vscode.Memento,
    projectId: string,
    tabLabel: string,
    onOpenIssue: (issueId: string, label: string) => void,
    onIssueUpdated: (issueId: string) => void,
    onDispose: () => void
  ): KanbanBoardPanel {
    const panel = vscode.window.createWebviewPanel(
      "linear.kanbanBoard",
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
    panel.webview.html = getWebviewHtml(
      panel.webview,
      extensionUri,
      nonce,
      { panel: "board", projectId }
    );

    return new KanbanBoardPanel(
      panel,
      getService,
      workspaceState,
      projectId,
      onOpenIssue,
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

  private async loadBoard(options?: { invalidate?: boolean }): Promise<void> {
    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    if (options?.invalidate) {
      cache.invalidate(this.projectId);
    }

    try {
      const meta = await service.fetchProjectBoardMeta(this.projectId);
      const viewState = loadBoardViewState(
        this.workspaceState,
        this.projectId
      );
      const workflowStates = await service.fetchTeamWorkflowStates(
        meta.teamId
      );

      let page;
      if (cache.getIssues(this.projectId).length === 0) {
        page = await service.fetchProjectBoardPage(this.projectId);
        cache.appendPage(this.projectId, page);
      } else {
        page = {
          issues: cache.getIssues(this.projectId),
          hasNextPage: cache.hasNextPage(this.projectId),
          endCursor: cache.getCursor(this.projectId),
        };
      }

      this.post({
        type: "boardLoaded",
        meta,
        workflowStates,
        viewState,
        page,
      });
      this.panel.title = `${meta.name} · Board`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load board.";
      this.post({ type: "mutationError", message });
    }
  }

  private async loadMore(cursor?: string): Promise<void> {
    const service = this.getService();
    const page = await service.fetchProjectBoardPage(this.projectId, cursor);
    cache.appendPage(this.projectId, page, { append: true });
    this.post({ type: "boardPageLoaded", page, append: true });
  }

  private enqueueMutation(issueId: string, run: () => Promise<void>): void {
    const prev = this.mutationQueues.get(issueId) ?? Promise.resolve();
    const next = prev.then(run).catch(() => undefined);
    this.mutationQueues.set(issueId, next);
  }

  private patchBoardIssue(issue: LinearBoardIssueCard): void {
    cache.patchIssue(this.projectId, issue);
    this.post({ type: "boardIssueUpdated", issue });
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
      case "refreshBoard":
        await this.loadBoard({ invalidate: raw.type === "refreshBoard" });
        return;

      case "loadBoardPage":
        await this.loadMore(raw.cursor);
        return;

      case "saveBoardViewState":
        await saveBoardViewState(
          this.workspaceState,
          raw.projectId,
          raw.viewState
        );
        return;

      case "openIssue":
        this.onOpenIssue(raw.issueId, raw.label);
        return;

      case "openExternal":
        await vscode.env.openExternal(vscode.Uri.parse(raw.url));
        return;

      case "moveIssue": {
        const previous = cache
          .getIssues(this.projectId)
          .find((issue) => issue.id === raw.issueId);
        const previousStateId = previous?.state.id;

        if (previous) {
          this.patchBoardIssue({
            ...previous,
            state: {
              ...previous.state,
              id: raw.stateId,
              name: previous.state.name,
            },
          });
        }

        this.enqueueMutation(raw.issueId, async () => {
          try {
            const updated = await service.updateIssue(raw.issueId, {
              stateId: raw.stateId,
            });
            const card: LinearBoardIssueCard = {
              id: updated.id,
              identifier: updated.identifier,
              title: updated.title,
              url: updated.url,
              updatedAt: updated.updatedAt,
              createdAt: updated.updatedAt,
              priority: updated.priority,
              priorityLabel: updated.priorityLabel,
              state: updated.state,
              assignee: updated.assignee,
              labels: updated.labels,
              milestone: updated.milestone,
            };
            this.patchBoardIssue(card);
            this.onIssueUpdated(updated.id);
          } catch (error) {
            if (previous && previousStateId) {
              this.post({
                type: "boardMoveFailed",
                issueId: raw.issueId,
                previousStateId,
                message:
                  error instanceof Error ? error.message : "Move failed.",
              });
            }
          }
        });
        return;
      }
    }
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
    this.onDisposeCallback();
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/panels/KanbanBoardPanel.ts
git commit -m "feat: add KanbanBoardPanel extension host controller"
```

---

### Task 8: Extend PanelManager and config commands

**Files:**
- Modify: `src/panels/PanelManager.ts`
- Modify: `src/config.ts`

**Interfaces:**
- Consumes: `KanbanBoardPanel` from Task 7
- Produces:
  - `panelKey(kind: "issue" | "board", id: string): string`
  - `PanelManager.openBoard(projectId, tabLabel): void`
  - `CMD_OPEN_PROJECT_BOARD = "linear.openProjectBoard"`
  - `CMD_OPEN_PROJECT_IN_BROWSER = "linear.openProjectInBrowser"`

- [ ] **Step 1: Add command ids to `src/config.ts`**

```typescript
export const CMD_OPEN_PROJECT_BOARD = "linear.openProjectBoard";
export const CMD_OPEN_PROJECT_IN_BROWSER = "linear.openProjectInBrowser";
```

- [ ] **Step 2: Extend `src/panels/PanelManager.ts`**

```typescript
import { KanbanBoardPanel } from "./KanbanBoardPanel";

export function panelKey(kind: "issue" | "board", id: string): string {
  return `${kind}:${id}`;
}

type ManagedPanel = IssueDetailPanel | KanbanBoardPanel;

export class PanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, ManagedPanel>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
    private readonly getService: () => LinearService,
    private readonly onIssueUpdated: (issueId: string) => void
  ) {}

  openIssue(issueId: string, tabLabel: string): void {
    const key = panelKey("issue", issueId);
    const existing = this.panels.get(key);
    if (existing && existing instanceof IssueDetailPanel) {
      existing.reveal();
      return;
    }

    const panel = IssueDetailPanel.create(
      this.extensionUri,
      this.getService,
      issueId,
      tabLabel,
      (updatedIssueId) => this.onIssueUpdated(updatedIssueId),
      () => this.panels.delete(key)
    );
    this.panels.set(key, panel);
  }

  openBoard(projectId: string, tabLabel: string): void {
    const key = panelKey("board", projectId);
    const existing = this.panels.get(key);
    if (existing && existing instanceof KanbanBoardPanel) {
      existing.reveal();
      return;
    }

    const panel = KanbanBoardPanel.create(
      this.extensionUri,
      this.getService,
      this.workspaceState,
      projectId,
      tabLabel,
      (issueId, label) => this.openIssue(issueId, label),
      (issueId) => this.onIssueUpdated(issueId),
      () => this.panels.delete(key)
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

- [ ] **Step 3: Update `src/extension.ts` PanelManager construction**

```typescript
  const panelManager = new PanelManager(
    context.extensionUri,
    context.workspaceState,
    () => linearService,
    (issueId) => {
      treeProvider.refresh();
    }
  );
```

- [ ] **Step 4: Run typecheck**

Run: `yarn typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/panels/PanelManager.ts src/config.ts src/extension.ts
git commit -m "feat: extend PanelManager with board panel support"
```

---

### Task 9: Webview dependencies and panel routing

**Files:**
- Modify: `package.json`
- Create: `webview-ui/src/bootstrap.ts`
- Modify: `webview-ui/src/App.tsx`
- Modify: `webview-ui/src/hooks/useVscodeMessaging.ts` (export shared `post` helper)

**Interfaces:**
- Consumes: `window.__LINEAR_PANEL__` bootstrap from Task 6
- Produces: App routes to Issue Detail (existing) or Board shell (Task 10–11)

- [ ] **Step 1: Add webview dependencies to `package.json`**

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/utilities": "^3.2.2",
"react-window": "^1.8.11",
"@types/react-window": "^1.8.8"
```

(`@types/react-window` in devDependencies)

- [ ] **Step 2: Install deps**

Run: `yarn install`
Expected: lockfile updated, no peer errors

- [ ] **Step 3: Create `webview-ui/src/bootstrap.ts`**

```typescript
export interface WebviewPanelBootstrap {
  panel: "issue" | "board";
  issueId?: string;
  projectId?: string;
}

declare global {
  interface Window {
    __LINEAR_PANEL__?: WebviewPanelBootstrap;
  }
}

export function readBootstrap(): WebviewPanelBootstrap {
  return window.__LINEAR_PANEL__ ?? { panel: "issue" };
}
```

- [ ] **Step 4: Update `webview-ui/src/App.tsx`**

```tsx
import { readBootstrap } from "./bootstrap";
import { useVscodeMessaging } from "./hooks/useVscodeMessaging";
import { useBoardMessaging } from "./hooks/useBoardMessaging";
import { IssueDetailView } from "./components/IssueDetailView";
import { BoardApp } from "./components/board/BoardApp";
import "./styles.css";

const bootstrap = readBootstrap();

export function App() {
  if (bootstrap.panel === "board") {
    return <BoardApp />;
  }

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

- [ ] **Step 5: Create board shell placeholder `webview-ui/src/components/board/BoardApp.tsx`**

```tsx
import { useBoardMessaging } from "../../hooks/useBoardMessaging";

export function BoardApp() {
  const { meta, error } = useBoardMessaging();
  if (error) {
    return <main className="error">{error}</main>;
  }
  if (!meta) {
    return <main className="loading">Loading board…</main>;
  }
  return <main className="loading">Board shell — {meta.name}</main>;
}
```

- [ ] **Step 6: Build webview**

Run: `yarn build:webview`
Expected: success

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock webview-ui/src/bootstrap.ts webview-ui/src/App.tsx webview-ui/src/components/board/BoardApp.tsx
git commit -m "feat: add webview panel routing and board shell"
```

---

### Task 10: Board messaging hook and toolbar

**Files:**
- Create: `webview-ui/src/hooks/useBoardMessaging.ts`
- Create: `webview-ui/src/components/board/BoardToolbar.tsx`
- Modify: `webview-ui/src/components/board/BoardApp.tsx`

**Interfaces:**
- Consumes: `boardLoaded`, `boardPageLoaded`, `boardIssueUpdated`, `boardMoveFailed` messages
- Produces: `{ meta, workflowStates, viewState, issues, error, post, setViewState, loadMore, hasNextPage }`

- [ ] **Step 1: Create `useBoardMessaging.ts`**

```typescript
import { useCallback, useEffect, useState } from "react";
import { vscode } from "../vscode";

export interface BoardIssueCard {
  id: string;
  identifier: string;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; type: string; color: string };
  assignee?: { id: string; name: string };
  labels: { id: string; name: string; color?: string }[];
  milestone?: { id: string; name: string };
}

export interface BoardMeta {
  id: string;
  name: string;
  url: string;
  teamId: string;
  progress: number;
}

export interface BoardFilters {
  statusIds: string[];
  labelIds: string[];
  assigneeIds: Array<string | "__unassigned__">;
  search: string;
}

export interface BoardViewState {
  view: "kanban" | "list";
  groupBy: "none" | "phaseLabel" | "assignee";
  filters: BoardFilters;
  sortBy: "priority" | "updatedAt" | "createdAt" | "identifier";
}

type ExtensionMessage =
  | {
      type: "boardLoaded";
      meta: BoardMeta;
      workflowStates: { id: string; name: string; color: string }[];
      viewState: BoardViewState;
      page: { issues: BoardIssueCard[]; hasNextPage: boolean; endCursor?: string };
    }
  | {
      type: "boardPageLoaded";
      page: { issues: BoardIssueCard[]; hasNextPage: boolean; endCursor?: string };
      append: boolean;
    }
  | { type: "boardIssueUpdated"; issue: BoardIssueCard }
  | {
      type: "boardMoveFailed";
      issueId: string;
      previousStateId: string;
      message: string;
    }
  | { type: "mutationError"; message: string };

export function useBoardMessaging() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [workflowStates, setWorkflowStates] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [viewState, setViewStateLocal] = useState<BoardViewState | null>(null);
  const [issues, setIssues] = useState<BoardIssueCard[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const post = useCallback((message: unknown) => {
    vscode?.postMessage(message);
  }, []);

  const setViewState = useCallback(
    (next: BoardViewState) => {
      setViewStateLocal(next);
      if (meta) {
        post({ type: "saveBoardViewState", projectId: meta.id, viewState: next });
      }
    },
    [meta, post]
  );

  const loadMore = useCallback(() => {
    if (meta && endCursor) {
      post({ type: "loadBoardPage", projectId: meta.id, cursor: endCursor });
    }
  }, [meta, endCursor, post]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "boardLoaded":
          setMeta(msg.meta);
          setWorkflowStates(msg.workflowStates);
          setViewStateLocal(msg.viewState);
          setIssues(msg.page.issues);
          setHasNextPage(msg.page.hasNextPage);
          setEndCursor(msg.page.endCursor);
          setError(null);
          break;
        case "boardPageLoaded":
          setIssues((prev) =>
            msg.append ? [...prev, ...msg.page.issues] : msg.page.issues
          );
          setHasNextPage(msg.page.hasNextPage);
          setEndCursor(msg.page.endCursor);
          break;
        case "boardIssueUpdated":
          setIssues((prev) =>
            prev.map((issue) =>
              issue.id === msg.issue.id ? msg.issue : issue
            )
          );
          break;
        case "boardMoveFailed":
          setIssues((prev) =>
            prev.map((issue) =>
              issue.id === msg.issueId
                ? {
                    ...issue,
                    state: {
                      ...issue.state,
                      id: msg.previousStateId,
                    },
                  }
                : issue
            )
          );
          setError(msg.message);
          break;
        case "mutationError":
          setError(msg.message);
          break;
      }
    };
    window.addEventListener("message", handler);
    post({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, [post]);

  return {
    meta,
    workflowStates,
    viewState,
    issues,
    error,
    hasNextPage,
    post,
    setViewState,
    loadMore,
  };
}
```

- [ ] **Step 2: Create `BoardToolbar.tsx`**

Toolbar with: Kanban/List toggle, group-by select (none / phase / assignee), search input, filter chips (status, label, assignee multi-select simplified as dropdowns), refresh button, Open in Linear link.

Key handlers:

```tsx
// view toggle
setViewState({ ...viewState, view: "kanban" | "list" });

// search
setViewState({
  ...viewState,
  filters: { ...viewState.filters, search: value },
});

// refresh
post({ type: "refreshBoard", projectId: meta.id });
```

- [ ] **Step 3: Wire `BoardApp.tsx`**

```tsx
import { useMemo } from "react";
import { useBoardMessaging } from "../../hooks/useBoardMessaging";
import { BoardToolbar } from "./BoardToolbar";
import { KanbanBoardView } from "./KanbanBoardView";
import { ListBoardView } from "./ListBoardView";

// Client-side filter/group helpers duplicated minimally in webview-ui/src/boardLogic.ts
// OR import built bundle — prefer duplicate 40-line pure fns in webview-ui/src/boardLogic.ts
// mirroring src/linear/boardFilters.ts (copy applyBoardFilters + groupIssuesIntoSwimlanes)

export function BoardApp() {
  const {
    meta,
    workflowStates,
    viewState,
    issues,
    error,
    hasNextPage,
    post,
    setViewState,
    loadMore,
  } = useBoardMessaging();

  const filteredIssues = useMemo(() => {
    if (!viewState) return [];
    return applyBoardFilters(issues, viewState.filters);
  }, [issues, viewState]);

  if (!meta || !viewState) {
    return <main className="loading">Loading board…</main>;
  }

  return (
    <main className="board-app">
      <BoardToolbar
        meta={meta}
        viewState={viewState}
        workflowStates={workflowStates}
        issues={issues}
        error={error}
        onViewStateChange={setViewState}
        onRefresh={() => post({ type: "refreshBoard", projectId: meta.id })}
        onOpenExternal={() => post({ type: "openExternal", url: meta.url })}
      />
      {viewState.view === "kanban" ? (
        <KanbanBoardView
          issues={filteredIssues}
          workflowStates={workflowStates}
          groupBy={viewState.groupBy}
          onMoveIssue={(issueId, stateId) =>
            post({ type: "moveIssue", issueId, stateId, projectId: meta.id })
          }
          onOpenIssue={(issue) =>
            post({
              type: "openIssue",
              issueId: issue.id,
              label: `${issue.identifier}: ${issue.title}`,
            })
          }
        />
      ) : (
        <ListBoardView
          issues={filteredIssues}
          workflowStates={workflowStates}
          sortBy={viewState.sortBy}
          onChangeSort={(sortBy) => setViewState({ ...viewState, sortBy })}
          onChangeStatus={(issueId, stateId) =>
            post({ type: "moveIssue", issueId, stateId, projectId: meta.id })
          }
          onOpenIssue={(issue) =>
            post({
              type: "openIssue",
              issueId: issue.id,
              label: `${issue.identifier}: ${issue.title}`,
            })
          }
        />
      )}
      {hasNextPage && (
        <footer className="board-footer">
          <button type="button" onClick={loadMore}>
            Load more issues
          </button>
        </footer>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Create `webview-ui/src/boardLogic.ts`** — copy `applyBoardFilters`, `groupIssuesIntoSwimlanes`, `sortIssuesForList`, `extractPhaseLabel` from Task 3 (duplicate to avoid bundling extension host code).

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/hooks/useBoardMessaging.ts webview-ui/src/components/board/ webview-ui/src/boardLogic.ts
git commit -m "feat: add board messaging hook, toolbar, and app shell"
```

---

### Task 11: Kanban view with @dnd-kit and react-window

**Files:**
- Create: `webview-ui/src/components/board/KanbanBoardView.tsx`
- Create: `webview-ui/src/components/board/IssueCard.tsx`
- Modify: `webview-ui/src/styles.css`

**Interfaces:**
- Consumes: filtered issues, workflow states, `groupBy`, callbacks `onMoveIssue`, `onOpenIssue`
- Produces: swimlane × column Kanban with drag-drop status change (optimistic via hook)

- [ ] **Step 1: Create `IssueCard.tsx`**

Compact card: identifier, title, priority badge, assignee, phase label chip. `onClick` → `onOpenIssue`. Uses VS Code CSS variables.

- [ ] **Step 2: Create `KanbanBoardView.tsx`**

```tsx
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { FixedSizeList } from "react-window";
import { groupIssuesIntoSwimlanes } from "../../boardLogic";
import { IssueCard } from "./IssueCard";

const PHASE_PREFIX = "phase-";
const CARD_HEIGHT = 88;
const COLUMN_WIDTH = 280;

export function KanbanBoardView({ issues, workflowStates, groupBy, onMoveIssue, onOpenIssue }) {
  const lanes = groupIssuesIntoSwimlanes(issues, groupBy, PHASE_PREFIX);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const issueId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId || !String(overId).startsWith("column:")) return;
    const stateId = String(overId).replace("column:", "");
    onMoveIssue(issueId, stateId);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {lanes.map((lane) => (
          <section key={lane.id} className="kanban-swimlane">
            {groupBy !== "none" && <h3 className="swimlane-title">{lane.label}</h3>}
            <div className="kanban-columns">
              {workflowStates.map((state) => {
                const columnIssues = lane.issues.filter((i) => i.state.id === state.id);
                return (
                  <div key={state.id} className="kanban-column" data-droppable-id={`column:${state.id}`}>
                    <header className="column-header" style={{ borderColor: state.color }}>
                      {state.name}
                      <span className="column-count">{columnIssues.length}</span>
                    </header>
                    <FixedSizeList
                      height={480}
                      width={COLUMN_WIDTH}
                      itemCount={columnIssues.length}
                      itemSize={CARD_HEIGHT}
                    >
                      {({ index, style }) => (
                        <div style={style}>
                          <IssueCard
                            issue={columnIssues[index]}
                            onOpen={() => onOpenIssue(columnIssues[index])}
                          />
                        </div>
                      )}
                    </FixedSizeList>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <DragOverlay />
    </DndContext>
  );
}
```

Implement droppable columns with `@dnd-kit/core` `useDroppable({ id: \`column:${state.id}\` })` wrapper and draggable cards with `useDraggable({ id: issue.id })`.

- [ ] **Step 3: Add board CSS to `styles.css`**

```css
.board-app { display: flex; flex-direction: column; height: 100vh; }
.kanban-board { overflow: auto; flex: 1; padding: 8px; }
.kanban-swimlane { margin-bottom: 16px; }
.kanban-columns { display: flex; gap: 12px; overflow-x: auto; }
.kanban-column {
  min-width: 280px;
  background: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}
.column-header {
  padding: 8px 12px;
  font-weight: 600;
  border-bottom: 3px solid;
  display: flex;
  justify-content: space-between;
}
.issue-card {
  margin: 6px 8px;
  padding: 8px;
  border-radius: 4px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  cursor: grab;
}
.issue-card:hover { border-color: var(--vscode-focusBorder); }
```

- [ ] **Step 4: Build and smoke test**

Run: `yarn build:webview`
Expected: success, no TS errors

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/components/board/KanbanBoardView.tsx webview-ui/src/components/board/IssueCard.tsx webview-ui/src/styles.css
git commit -m "feat: add virtualized Kanban board with drag-drop"
```

---

### Task 12: List view with inline status

**Files:**
- Create: `webview-ui/src/components/board/ListBoardView.tsx`

**Interfaces:**
- Consumes: filtered/sorted issues, workflow states, sort callbacks
- Produces: virtualized dense table with inline status `<select>` → `onChangeStatus`

- [ ] **Step 1: Create `ListBoardView.tsx`**

```tsx
import { useMemo } from "react";
import { FixedSizeList } from "react-window";
import { sortIssuesForList } from "../../boardLogic";
import type { BoardIssueCard } from "../../hooks/useBoardMessaging";

const ROW_HEIGHT = 36;

export function ListBoardView({
  issues,
  workflowStates,
  sortBy,
  onChangeSort,
  onChangeStatus,
  onOpenIssue,
}: {
  issues: BoardIssueCard[];
  workflowStates: { id: string; name: string; color: string }[];
  sortBy: "priority" | "updatedAt" | "createdAt" | "identifier";
  onChangeSort: (sortBy: "priority" | "updatedAt" | "createdAt" | "identifier") => void;
  onChangeStatus: (issueId: string, stateId: string) => void;
  onOpenIssue: (issue: BoardIssueCard) => void;
}) {
  const sorted = useMemo(
    () => sortIssuesForList(issues, sortBy),
    [issues, sortBy]
  );

  return (
    <div className="list-board">
      <header className="list-header">
        <span>ID</span>
        <span>Title</span>
        <span>
          Status
          <select
            aria-label="Sort"
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value as typeof sortBy)}
          >
            <option value="priority">Priority</option>
            <option value="updatedAt">Updated</option>
            <option value="createdAt">Created</option>
            <option value="identifier">ID</option>
          </select>
        </span>
        <span>Assignee</span>
        <span>Labels</span>
      </header>
      <FixedSizeList
        height={520}
        width="100%"
        itemCount={sorted.length}
        itemSize={ROW_HEIGHT}
      >
        {({ index, style }) => {
          const issue = sorted[index];
          return (
            <div style={style} className="list-row">
              <button type="button" className="list-id" onClick={() => onOpenIssue(issue)}>
                {issue.identifier}
              </button>
              <span className="list-title">{issue.title}</span>
              <select
                value={issue.state.id}
                onChange={(e) => onChangeStatus(issue.id, e.target.value)}
              >
                {workflowStates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span>{issue.assignee?.name ?? "—"}</span>
              <span className="list-labels">
                {issue.labels.map((l) => l.name).join(", ")}
              </span>
            </div>
          );
        }}
      </FixedSizeList>
    </div>
  );
}
```

- [ ] **Step 2: Add list CSS**

```css
.list-board { flex: 1; padding: 8px 16px; }
.list-header, .list-row {
  display: grid;
  grid-template-columns: 80px 1fr 140px 120px 160px;
  gap: 8px;
  align-items: center;
}
.list-row { border-bottom: 1px solid var(--vscode-panel-border); }
.list-id { background: none; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; }
```

- [ ] **Step 3: Build**

Run: `yarn build:webview`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/components/board/ListBoardView.tsx webview-ui/src/styles.css
git commit -m "feat: add virtualized List board view with inline status"
```

---

### Task 13: Wire commands, sidebar, and package.json

**Files:**
- Modify: `src/commands.ts`
- Modify: `src/providers/linearTreeDataProvider.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PanelManager.openBoard`, `CMD_OPEN_PROJECT_BOARD`, `CMD_OPEN_PROJECT_IN_BROWSER`
- Produces: project sidebar click → board; context menu → browser; QuickPick command

- [ ] **Step 1: Register commands in `src/commands.ts`**

Add imports and handlers:

```typescript
import {
  CMD_OPEN_PROJECT_BOARD,
  CMD_OPEN_PROJECT_IN_BROWSER,
} from "./config";

// inside registerLinearCommands:

    vscode.commands.registerCommand(
      CMD_OPEN_PROJECT_BOARD,
      async (projectId?: string, label?: string) => {
        const service = ctx.getService();
        if (!service.isConfigured()) {
          void vscode.window.showWarningMessage(
            "Linear is not connected. Set your API key first."
          );
          return;
        }

        let id = projectId;
        let tabLabel = label;
        if (!id) {
          const projects = (await ctx
            .getTreeProvider()
            .getCachedSection("projects")) as import("./linear/types").LinearProjectSummary[] | undefined;
          if (!projects?.length) {
            void vscode.window.showInformationMessage(
              "No projects loaded. Refresh the Linear sidebar first."
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            projects.map((p) => ({
              label: p.name,
              description: `${p.state} · ${p.progress}%`,
              projectId: p.id,
            })),
            { placeHolder: "Select a project board" }
          );
          if (!pick) return;
          id = pick.projectId;
          tabLabel = pick.label;
        }

        ctx.getPanelManager().openBoard(id!, tabLabel ?? "Project Board");
      }
    ),

    vscode.commands.registerCommand(
      CMD_OPEN_PROJECT_IN_BROWSER,
      (_projectId: string, _label: string, url?: string) => {
        if (url) {
          void vscode.env.openExternal(vscode.Uri.parse(url));
        }
      }
    ),
```

Add helper on `LinearTreeDataProvider`:

```typescript
  getCachedSection(sectionId: LinearSectionId) {
    const entry = this.cache.get(sectionId);
    return entry?.state === "loaded" ? entry.items : undefined;
  }
```

- [ ] **Step 2: Update project items in `linearTreeDataProvider.ts`**

```typescript
import {
  CMD_OPEN_ISSUE,
  CMD_OPEN_PROJECT_BOARD,
  CMD_OPEN_PROJECT_IN_BROWSER,
} from "../config";

// in mapItems case "projects":
        const item = new LinearTreeItem(
          LinearTreeItemKind.Project,
          project.name,
          vscode.TreeItemCollapsibleState.None,
          sectionId,
          project.url,
          tooltip
        );
        item.command = {
          command: CMD_OPEN_PROJECT_BOARD,
          title: "Open Project Board",
          arguments: [project.id, project.name, project.url],
        };
        item.contextValue = "linearProject";
        item.description = `${project.state} · ${project.progress}%`;
        return item;
```

Note: `LinearTreeItem` constructor sets `vscode.open` when url is passed — override `item.command` after construction (already done for issues).

- [ ] **Step 3: Update `package.json`**

Add commands:

```json
{
  "command": "linear.openProjectBoard",
  "title": "Linear: Open Project Board",
  "icon": "$(layout)"
},
{
  "command": "linear.openProjectInBrowser",
  "title": "Linear: Open Project in Browser",
  "icon": "$(link-external)"
}
```

Add settings:

```json
"configuration": {
  "title": "Linear Connect",
  "properties": {
    "linear.board.phaseLabelPrefix": {
      "type": "string",
      "default": "phase-",
      "description": "Label prefix for phase swimlane grouping on project boards."
    }
  }
}
```

Add context menu:

```json
"view/item/context": [
  {
    "command": "linear.openProjectInBrowser",
    "when": "view == linear.sidebar && viewItem == linearProject",
    "group": "navigation"
  }
]
```

- [ ] **Step 4: Run full verify**

Run: `yarn typecheck && yarn test && yarn build`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands.ts src/providers/linearTreeDataProvider.ts package.json
git commit -m "feat: wire project board commands and sidebar navigation"
```

---

### Task 14: CHANGELOG and manual verification

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: completed Phase 2 feature set
- Produces: documented release notes; F5 dev loop verified

- [ ] **Step 1: Add CHANGELOG entry**

```markdown
## [Unreleased]

### Added
- Project Kanban board — open from sidebar project click or **Linear: Open Project Board** command
- List view toggle with sortable columns and inline status changes
- Drag-and-drop status changes on Kanban cards (optimistic UI)
- Board filters: status, label, assignee, and title search
- Phase-label swimlane grouping (default; configurable via `linear.board.phaseLabelPrefix`)
- Virtualized scrolling for large projects with paginated load-more
- Click board card → opens existing Task Detail panel
- Context menu: Open Project in Browser
```

- [ ] **Step 2: Check bundle size**

Run: `yarn build:webview && gzip -c dist/webview/assets/*.js | wc -c`
Expected: total gzipped JS **< 500000** bytes (~150 KB target)

- [ ] **Step 3: Manual F5 verification checklist**

- [ ] F5 → Extension Development Host (preLaunchTask builds webview)
- [ ] Set API key with write access
- [ ] Expand Projects → click project → Kanban board tab opens
- [ ] Toggle List view → issues render in table
- [ ] Drag card to another column → status updates in Linear web
- [ ] Failed move (simulate offline) → card reverts + error shown
- [ ] Filter by phase label group → swimlanes appear
- [ ] Click card → Task Detail tab opens (reuse, no duplicate issue tab)
- [ ] Command palette → **Linear: Open Project Board** → QuickPick works
- [ ] Context menu → Open Project in Browser
- [ ] Load more → additional issues append
- [ ] Re-click same project → reveals existing board tab

- [ ] **Step 4: Final CI verify**

Run: `yarn typecheck && yarn test && yarn build`
Expected: PASS (38+ tests)

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add Phase 2 Kanban/List board changelog"
```

---

## Self-Review

### Spec coverage (Phase 2 PRD)

| PRD requirement | Task |
|-----------------|------|
| Project board (Kanban + List toggle) | Tasks 10–12 |
| Drag-drop status change (optimistic) | Tasks 7, 11 |
| Filters: status, label, assignee | Tasks 3, 10 |
| Group by phase label | Tasks 3, 10–11 |
| Virtualized scrolling | Tasks 11–12 |
| Click card → Task Detail | Tasks 7, 8, 11–12 |
| Project-scoped paginated fetch | Tasks 4–5 |
| Skip bulk edit | Not in plan ✓ |
| Skip WIP limits | Not in plan ✓ |
| Skip milestone swimlanes | Not in plan ✓ |
| API key never in webview | Tasks 5, 7 |
| Panel dedupe `board:{projectId}` | Task 8 |
| Interim project navigation | Task 13 |
| Bundle size < 500 KB gzipped | Task 14 step 2 |

**Gaps / deferred intentionally:**

- Cmd/Ctrl+Click project → board (VS Code TreeView lacks modifier) — command + primary click interim; Phase 3 adds Project Detail primary
- Agent badge on cards — Phase 4
- Auto-refresh on window focus (30s debounce) — Phase 2.1 polish; manual refresh in toolbar MVP
- Per-column parallel pagination — unified fetch simpler; sufficient for 200-issue Abodi target
- `linear.board.clickBehavior` setting — Phase 2.1; default opens Task Detail in new tab
- Milestone groupBy — Phase 2.1; phase label covers Abodi MVP

### Placeholder scan

No TBD/TODO/implement-later steps. All code blocks are complete or specify exact file/function targets.

### Type consistency

- `LinearBoardIssueCard` defined Task 1, used Tasks 2, 4, 5, 7
- `BoardViewState` / `BoardFilters` defined Task 1, persisted Task 3, sent in `boardLoaded` Task 7
- `panelKey("board", projectId)` consistent Tasks 7–8
- `moveIssue` message shape consistent Tasks 1, 7, 11–12
- `WebviewPanelBootstrap.panel: "issue" | "board"` consistent Tasks 1, 6, 9
- `CMD_OPEN_PROJECT_BOARD` consistent Tasks 8, 13, package.json

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-phase2-kanban-list.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

**Prerequisite:** Phase 1 Task Detail panel should be built and F5-verified (already done per handoff). Run `git status` before starting — Phase 1 may be uncommitted.

**Follow-on:** After Phase 2 ships, create separate plan for Phase 3 Project Detail referencing `docs/superpowers/specs/2026-06-26-multi-panel-linear-workspace-prd.md`.

