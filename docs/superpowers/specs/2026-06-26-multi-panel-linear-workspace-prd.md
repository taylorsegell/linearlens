# Linear Connect — Multi-Panel Workspace PRD

**Version:** 0.1 (draft)  
**Date:** 2026-06-26  
**Status:** Awaiting review  
**Extension:** `linear-connect` (VS Code / Cursor)

---

## Executive Summary

Linear Connect today gives developers a **read-only sidebar** into Issues, Projects, Initiatives, and Reviews. Every meaningful action still happens in the Linear web app or via browser deep links.

This PRD defines the **next major phase**: three rich **editor-area panels** — **Task/Issue Detail**, **Project Detail**, and **Kanban/List Boards** — so advanced users (especially those orchestrating multi-agent workflows on complex initiatives like **Abodi: Private Beta Readiness**) can plan, triage, update, and delegate work **without leaving the IDE**.

The centerpiece is **native-feeling agent assignment**: map Linear issues (and sub-issues) to local AI agents (Cursor, Codex, Replicas, OpenClaw, custom) with optional write-back to Linear and hooks to trigger local agent runs.

**Recommended MVP order:** Task Detail (read + quick edits) → Kanban/List for projects → Project Detail → Agent assignment v1.

---

## Product Vision & Goals

### Vision

Make Linear Connect the **command center for agentic development** inside VS Code/Cursor: the sidebar is the index; the editor area is where work happens.

### Why multi-panel matters

| Pain today | Multi-panel solves |
|---|---|
| Sidebar rows open Linear in browser | In-IDE detail, edit, comment |
| No project-level view of issue flow | Kanban/List boards with drag status |
| No way to express "this issue goes to Agent X" | First-class agent assignment + dispatch |
| Context switching breaks flow state | Single window: code + issues + agents |
| Abodi-scale projects (100+ issues, phases, milestones) overwhelm a flat tree | Filtering, grouping, boards tuned for phased delivery |

### Target user

**Primary:** Power users who live in Linear + Cursor, run multiple AI agents, and manage complex, phased product work (Abodi-style).

**Secondary:** Teams using Linear for sprint planning who want lightweight IDE triage without a full Linear UI clone.

**Non-goals (this phase):**

- Replacing Linear web for admin (workflows, cycles config, team settings)
- Multi-account Linear support (deferred per AGENTS.md)
- Real-time collaborative editing (Google Docs-style)
- Building a general-purpose agent runtime (integrate with existing infra)

### Goals

1. **Reduce context switches** — ≥80% of daily triage (open issue, change status, assign, comment) doable in IDE.
2. **Support phased project structure** — filter/group by phase label, milestone, assignee, agent.
3. **Agent assignment as a primitive** — assign issue → agent visible in Linear (via label/custom field) + local dispatch hook.
4. **Stay Linear-native** — mutations sync back; extension is a view/controller, not a shadow DB.
5. **Performant on large projects** — Abodi-scale (200+ issues) usable without UI jank.

### Success criteria (see [Success Metrics](#success-metrics))

---

## Current State & Problem

### What exists (v2.x sidebar — solid, keep)

| Component | Implementation |
|---|---|
| Activity Bar container | `linear-explorer` |
| TreeView | `linear.sidebar` — 4 sections: Issues, Projects, Initiatives, Reviews |
| API | `@linear/sdk` via `LinearService`, Personal API Key in secrets |
| Issues UX | Lazy load, status grouping, status/project filters |
| Auth | OAuth provider (`linear`) for dependent extensions + API key for sidebar |
| Caching | Per-section in-memory cache in `LinearTreeDataProvider` |

### Gaps

1. **Navigation dead-end** — tree items use `vscode.open` → browser URL.
2. **Summary-only data** — no description, comments, sub-issues, milestones, attachments.
3. **No mutations** — cannot change status, assignee, labels, or create comments.
4. **No project workspace** — projects are a flat list; no board or detail view.
5. **No agent concept** — no bridge between Linear tasks and local agent infrastructure.
6. **Scale limits** — `PAGE_SIZE = 50`, no pagination UI, no project-scoped fetch.

### Problem statement

Power users building agentic systems need Linear to be **operational inside the IDE**, not just **visible**. The sidebar proves connectivity; the next phase must prove **utility**.

---

## Proposed Solution Overview

### Three panel types (editor-area)

All panels open as **`WebviewPanel`** tabs in the main editor group (same pattern as GitHub PR, Docker, Notion extensions). Shared React webview bundle, VS Code theme tokens, message bridge to extension host.

```
┌─────────────────────────────────────────────────────────────────┐
│ Activity Bar │  Sidebar (TreeView)  │  Editor Area              │
│   Linear     │  Issues ▾            │  ┌─ ABO-142 Task Detail ─┐ │
│              │    In Progress ▾     │  │ Title, desc, props   │ │
│              │      ABO-142 ←click  │  │ Sub-issues, comments │ │
│              │  Projects ▾          │  │ [Assign Agent ▾]     │ │
│              │    Abodi Beta ←click │  └──────────────────────┘ │
│              │                      │  ┌─ Abodi · Kanban ──────┐ │
│              │                      │  │ Todo │ Doing │ Done  │ │
│              │                      │  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

| Panel | Opens when | Primary purpose |
|---|---|---|
| **Task Detail** | Click issue (anywhere) | Full issue CRUD, sub-issues, comments, agent assign |
| **Project Detail** | Click project/initiative | Overview, milestones, progress, linked issues, open board |
| **Kanban / List Board** | From project detail, command, or project click (modifier) | Project-scoped issue workflow |

### Core principles

1. **Sidebar = navigator; editor = workspace** — don't cram boards into sidebar.
2. **One issue → one tab** — dedupe by issue ID; reveal existing tab on re-click.
3. **Optimistic UI + Linear as source of truth** — local optimistic state, reconcile on API response.
4. **Agent assignment is hybrid** — Linear-visible marker + local execution metadata.
5. **Incremental sync** — focus/refresh polling, not websocket (MVP).

---

## Detailed Panel Specifications

### 1. Task / Issue Detail Panel *(highest priority)*

#### Core content & layout

```
┌──────────────────────────────────────────────────────────────┐
│ ABO-142  [In Progress ▾]  P2  @you  🤖 Cursor        [↗][×] │
├──────────────────────────────────────────────────────────────┤
│ Title (editable inline)                                       │
├──────────────────────────┬───────────────────────────────────┤
│ Properties               │  Description (markdown)            │
│ · Project: Abodi Beta    │  ...                               │
│ · Milestone: Phase 2     │                                    │
│ · Labels [phase-2][...]  │                                    │
│ · Agent: Cursor ▾        │                                    │
│ · Branch / PR links      │                                    │
├──────────────────────────┴───────────────────────────────────┤
│ Sub-issues (3)                                    [+ Add]    │
│   ☐ ABO-143 Setup auth middleware                            │
│   ☐ ABO-144 Agent dispatch hook                              │
├──────────────────────────────────────────────────────────────┤
│ Comments (newest first)                          [+ Comment] │
│   @you · 2h ago · "Blocked on OAuth redirect URI"              │
├──────────────────────────────────────────────────────────────┤
│ Attachments · Activity (collapsed)                           │
└──────────────────────────────────────────────────────────────┘
```

#### Data loaded (GraphQL via SDK)

- Issue: title, description, state, priority, assignee, labels, project, milestone, parent, children, branchName, attachments, url
- Comments: paginated (20 initial, load more)
- Sub-issues: recursive one level deep in MVP; full tree phase 2
- Workflow states for team (status dropdown)

#### Key interactions

| Action | UX | Linear API |
|---|---|---|
| Edit title | Inline blur-save | `issueUpdate` |
| Edit description | Markdown editor, debounced save | `issueUpdate` |
| Change status | Header dropdown or `S` shortcut | `issueUpdate` stateId |
| Change priority | Property dropdown | `issueUpdate` |
| Assign human | Assignee picker | `issueUpdate` assigneeId |
| Assign agent | Agent picker (see deep dive) | Label and/or custom field + local state |
| Add/remove label | Multi-select chip UI | `issueLabelCreate` / remove |
| Add comment | Textarea + submit | `commentCreate` |
| Create sub-issue | Modal / inline row | `issueCreate` with parentId |
| Open in Linear | Header link | external URL |
| Copy issue ID / branch | Context menu | local |

#### Sync strategy

- **Open panel:** fetch full issue; show skeleton
- **While open:** poll every 60s when panel focused; pause when hidden
- **After local mutation:** optimistic update → API → rollback on error + toast
- **External changes:** poll detects `updatedAt` drift → merge or banner "Issue updated externally — refresh?"
- **Sidebar coherence:** emit `linear.issueUpdated` event → tree provider patches cached row

#### Abodi-specific affordances

- **Phase labels** — auto-detect labels matching `phase-*` or team convention; show phase badge in header
- **Agent chip** — distinct from human assignee; color per agent type
- **"Dispatch to agent"** — primary action when agent assigned and status is Todo/Backlog

---

### 2. Project Detail Panel

#### Core content & layout

```
┌──────────────────────────────────────────────────────────────┐
│ Abodi: Private Beta Readiness          [Kanban] [List] [↗]   │
│ Initiative: Abodi Platform · Lead: @you · 62% complete       │
├──────────────────────────────────────────────────────────────┤
│ Description (markdown, read/edit)                             │
├──────────────────────────┬───────────────────────────────────┤
│ Milestones               │  Key dates                        │
│ ● Phase 1 Backend  ✓     │  Start: Jan 2026                  │
│ ● Phase 2 API      45%   │  Target: Jun 2026                 │
│ ○ Phase 3 Expo     0%    │                                   │
├──────────────────────────┴───────────────────────────────────┤
│ Linked projects · Resources · Documents (links)              │
├──────────────────────────────────────────────────────────────┤
│ Recent issues (10)                        [Open full board →]│
└──────────────────────────────────────────────────────────────┘
```

#### Opens from

- Click **project** in sidebar → Project Detail (default)
- Click **initiative** → Initiative variant (shows child projects, rollup progress)
- `Cmd+Click` project → skip detail, open Kanban directly (power-user modifier)

#### Key interactions

- Edit description (if permissions allow)
- Click milestone → filter board to milestone scope
- **Open Kanban / List** — opens or focuses board panel for this project
- Jump to issue → opens Task Detail tab

#### Sync

- Load on open; cache project + milestones for 5 min
- Invalidate on mutation or manual refresh

---

### 3. Kanban / List Board Panel

#### Views

| View | Description |
|---|---|
| **Kanban** | Columns = workflow states (or custom grouping); cards = issues |
| **List** | Dense table: ID, title, status, assignee, agent, labels, priority |

#### Grouping & filters (Abodi-style)

| Dimension | Source | Default |
|---|---|---|
| Status columns | Team workflow states | Kanban default |
| Group by milestone | `milestoneId` | Off |
| Group by phase label | Label prefix `phase-` | **On for Abodi project** |
| Group by assignee | Human assignee | Off |
| Group by agent | Local + Linear label | Off |
| Filter: label | Multi-select | Persist per project |
| Filter: priority | P0–P4 | — |
| Search | Title / identifier | Full-text client filter |

#### Kanban interactions

- **Drag card → column** — status change (optimistic)
- **Click card** — open Task Detail (split or new tab; user setting)
- **Quick actions on hover** — status, assignee, agent, open in editor
- **Column WIP** — display count; warn only (no hard limit MVP)
- **+ Add issue** — create in project with default status for column

#### List interactions

- Sort by priority, updated, created, identifier
- Multi-select + bulk status change (phase 2)
- Inline status dropdown per row

#### Performance (large projects)

- Virtualized columns/rows (react-window)
- Project-scoped fetch with pagination (50 per page, infinite scroll per column or unified)
- Initial load: states + first page per column in parallel
- Background prefetch next pages

#### Sync

- Board state in webview store; extension host owns fetch + mutations
- On drag-drop: mutation → on success update card; on fail revert + error
- Refresh button + auto-refresh on window focus (30s debounce)

---

## Agent Assignment Deep Dive

### Conceptual model

**Human assignee** and **Agent assignee** are **orthogonal**:

| Field | Meaning | Stored in |
|---|---|---|
| Linear assignee | Human owner | Linear `assigneeId` |
| Agent assignee | Which AI executes work | Linear label **and** local registry |
| Dispatch state | Has agent been triggered? | Local only (MVP) |

This avoids overloading Linear's assignee with bot accounts and matches how agentic teams think: "I'm accountable, Cursor implements."

### Recommended write-back strategy (MVP)

**Primary: Label convention**

- On agent assign: add label `agent/cursor`, `agent/codex`, `agent/replica`, `agent/openclaw`, or `agent/custom-<slug>`
- Remove prior `agent/*` label on reassignment
- **Pros:** Visible to whole team in Linear, filterable, no admin setup
- **Cons:** Label namespace discipline required

**Optional: Custom field** (if workspace has one)

- If team creates `Agent` single-select field in Linear, extension prefers it over labels
- Detect via API at startup; fallback to labels

**Local metadata** (`globalState` + optional workspace config)

```typescript
interface AgentAssignment {
  issueId: string;
  agentId: string;           // "cursor" | "codex" | "custom:my-agent"
  assignedAt: string;
  dispatchedAt?: string;
  dispatchConfig?: {
    promptTemplate?: string;
    workspaceFolder?: string;
    command?: string;        // vscode command ID to run
  };
}
```

### Agent registry

**Built-in agents (shipped defaults):**

| ID | Display | Default dispatch |
|---|---|---|
| `cursor` | Cursor Agent | `cursor.agent.run` or open Composer with issue context |
| `codex` | Codex | Shell / configured CLI |
| `replica` | Replica | Configurable endpoint |
| `openclaw` | OpenClaw | User-defined command |

**Custom agents** — user adds via Settings JSON or "Add agent" UI:

```json
"linear.agents": [
  {
    "id": "backend-swarm",
    "label": "Backend Swarm",
    "icon": "robot",
    "dispatchCommand": "mySwarm.runIssue",
    "labelPrefix": "agent/backend-swarm"
  }
]
```

### UI patterns

1. **Agent picker** — dropdown in Task Detail properties: built-ins + custom + "Clear agent"
2. **Agent badge on cards** — Kanban/List show 🤖 + short name
3. **Dispatch button** — "Run agent" in Task Detail when agent assigned; confirms scope (issue title + description preview)
4. **Batch assign** (phase 2) — multi-select in List view → assign agent
5. **Sub-issue inheritance** — option: "Apply agent to open sub-issues" on parent assign

### Dispatch flow

```
User clicks "Run agent"
  → Extension builds context payload { issueId, identifier, title, description, labels, branchName, workspaceRoot }
  → Writes dispatchedAt locally
  → Executes agent.dispatchCommand (or built-in handler)
  → Optional: add comment to Linear "@agent dispatched via Cursor"
  → Optional: move status to "In Progress"
```

**Integration points:**

- `vscode.commands.executeCommand` for Cursor-native agents
- `vscode.tasks.executeTask` for CLI agents
- URI handler `linear-connect://dispatch?issue=ABO-142&agent=cursor` for external tools (OpenClaw)

### What stays local-only (MVP)

- Dispatch history / run logs
- Agent run status (running, failed, done) unless user opts in to comment sync
- Prompt templates per agent (workspace settings)

### Assumptions flagged

- Cursor exposes a stable command/hook for agent dispatch (may need thin adapter extension)
- Team agrees on `agent/*` label namespace
- OpenClaw integration is user-configured, not shipped

---

## Information Architecture & Navigation

### Click behavior matrix

| Source | Click | Result |
|---|---|---|
| Issue row (sidebar) | Primary | Open/focus Task Detail tab |
| Issue row | Cmd/Ctrl+Click | Open Linear in browser (preserve today) |
| Project row | Primary | Open Project Detail |
| Project row | Cmd/Ctrl+Click | Open Kanban directly |
| Initiative row | Primary | Open Initiative Detail (variant) |
| Review row | Primary | Open linked issue Task Detail, or PR URL |
| Board card | Primary | Task Detail (honor split setting) |

### Panel lifecycle

- **`PanelManager`** singleton tracks open panels by key (`issue:uuid`, `project:uuid`, `board:uuid`)
- Re-click → `reveal()` existing panel
- Close panel → dispose webview; keep cache 5 min for fast reopen
- **Max tabs** — no hard limit; warn at 10+ open issue tabs (soft)

### Navigation history

- Task Detail: **← / →** issue breadcrumbs within same project filter context (optional phase 2)
- Command palette:
  - `Linear: Open Issue…` (fuzzy picker)
  - `Linear: Open Project Board…`
  - `Linear: Go Back` (last 10 navigated entities)

### State persistence

| State | Storage |
|---|---|
| Open panel URLs | Session only |
| Board filters/grouping | `workspaceState` keyed by projectId |
| Last selected view (Kanban/List) | `workspaceState` |
| Agent registry | `globalState` + settings |
| Navigation history | `workspaceState` ring buffer |

### Editor layout options (setting)

- `linear.panel.openLocation`: `tab` (default) | `beside` (split editor)
- `linear.board.clickBehavior`: `detailTab` | `splitBeside`

---

## Technical Architecture Recommendations

### VS Code extension patterns

| Concern | Recommendation | Rationale |
|---|---|---|
| Sidebar | Keep existing `TreeView` | Works well as index |
| Rich panels | **`WebviewPanel`** in editor area | Full width, tabs, familiar UX |
| Shared UI | Single React app, multiple routes | One bundle, consistent design |
| Not CustomEditor | — | Issues aren't documents on disk |
| Not WebviewView for boards | — | Too cramped in sidebar |

### High-level module structure

```
src/
  extension.ts
  panels/
    PanelManager.ts           # dedupe, open, reveal, dispose
    IssueDetailPanel.ts       # webview lifecycle + message handler
    ProjectDetailPanel.ts
    KanbanBoardPanel.ts
  linear/
    linearClient.ts           # extend: fetchIssue, fetchProject, mutations
    issueQueries.ts
    projectQueries.ts
    mutations.ts              # updateIssue, createComment, etc.
    cache.ts                  # TTL cache, invalidation events
    types.ts                  # extend with full Issue, Project, Comment
  agents/
    registry.ts               # built-in + user agents
    assignment.ts             # label sync, local metadata
    dispatch.ts               # run agent commands
  providers/
    linearTreeDataProvider.ts # wire click → PanelManager
  webview/
    ui/                       # React app (Vite build → dist/webview/)
      App.tsx
      panels/
      components/
      hooks/useVscodeApi.ts
    messaging.ts              # typed protocol
  commands.ts
```

### Webview ↔ extension messaging protocol

```typescript
// webview → extension
type WebviewRequest =
  | { type: "ready" }
  | { type: "updateIssue"; issueId: string; patch: IssuePatch }
  | { type: "assignAgent"; issueId: string; agentId: string | null }
  | { type: "dispatchAgent"; issueId: string }
  | { type: "createComment"; issueId: string; body: string }
  | { type: "moveIssue"; issueId: string; stateId: string; boardContext: string };

// extension → webview
type ExtensionMessage =
  | { type: "issueLoaded"; issue: LinearIssueDetail }
  | { type: "issueUpdated"; issue: LinearIssueDetail }
  | { type: "mutationError"; message: string }
  | { type: "theme"; colors: Record<string, string> };
```

### Data fetching & caching

| Layer | Strategy |
|---|---|
| Summary lists (sidebar) | Existing section cache; patch rows on `issueUpdated` events |
| Detail entities | Fetch on panel open; cache in `Map<id, { data, fetchedAt }>` |
| Board | Project-scoped query; column paginated cursors |
| Invalidation | TTL 5 min + explicit on mutation + manual refresh |
| Dedup | Coalesce in-flight requests per entity ID |

### Mutations

- All mutations in extension host (never expose API key to webview)
- Optimistic: webview applies patch locally; extension confirms or rolls back
- Queue: serialize mutations per issue ID to prevent race conditions
- Rate limit: respect Linear API limits; exponential backoff on 429

### Build pipeline

- esbuild for extension host (current)
- Vite for webview React bundle → `dist/webview/`
- CSP: nonce-based scripts; `localResourceRoots` restricted
- Use `@vscode/webview-ui-toolkit` or Radix + CSS variables from `getTheme()`

### Performance targets

| Metric | Target |
|---|---|
| Task Detail first paint | < 500ms cached, < 1.5s cold |
| Kanban initial load (200 issues) | < 2s with pagination |
| Drag-drop status update felt latency | < 100ms optimistic |
| Webview bundle size | < 500 KB gzipped |

### Auth note

Sidebar uses Personal API Key today; OAuth session available for dependent extensions. **Recommendation:** unify on OAuth token for sidebar when scopes include `write` (phase 1.5), keep API key as fallback. Mutations require write scope.

---

## Phasing & MVP Definition

### Phase 1 — Task Detail MVP *(4–6 weeks)*

**Ship:**

- Click issue → Task Detail tab
- Read: title, description, status, priority, assignee, labels, project, sub-issues (1 level), comments (read)
- Write: title, description, status, priority, comment create
- Sidebar sync on mutation
- Open in Linear link

**Skip:** agent assignment, attachments, activity feed

**Exit:** Daily triage on Abodi issues without browser for read + basic update.

---

### Phase 2 — Kanban / List MVP *(4–5 weeks)*

**Ship:**

- Project board (Kanban + List toggle)
- Drag-drop status change
- Filters: status, label, assignee; group by phase label
- Virtualized scrolling
- Click card → Task Detail

**Skip:** bulk edit, WIP limits, milestone swimlanes

**Exit:** Abodi Phase 2 board usable for weekly planning in IDE.

---

### Phase 3 — Project Detail *(2–3 weeks)*

**Ship:**

- Project + Initiative detail panels
- Milestones, progress, description
- Jump to board / issues

**Skip:** document editing, resource uploads

---

### Phase 4 — Agent Assignment v1 *(3–4 weeks)*

**Ship:**

- Agent registry (built-ins + custom config)
- Assign via label write-back
- Local dispatch command + "Run agent" button
- Agent badge on Task Detail + board cards
- Filter board by agent

**Skip:** dispatch status sync to Linear, batch assign, sub-issue inheritance

---

### Phase 5 — Polish & scale *(ongoing)*

- OAuth write scope unification
- Custom field support for agent
- Bulk operations
- Milestone swimlanes
- Optional Linear webhook / serverless refresh (if needed)
- l10n, multi-account (if prioritized)

### Prioritization rationale

Task Detail first — **highest daily frequency**, unlocks mutations infrastructure. Kanban second — **project-scale visualization** for Abodi. Project Detail third — important but less daily than issues. Agent assignment fourth — **differentiator** but depends on stable issue panel + dispatch adapters.

---

## Open Questions & Risks

### Open questions

| # | Question | Options | Recommendation |
|---|---|---|---|
| OQ-1 | OAuth vs API key for mutations? | OAuth write / API key only / both | Both; prefer OAuth long-term |
| OQ-2 | Agent write-back: label vs custom field? | Label / custom field / local only | Label MVP; custom field if present |
| OQ-3 | Cursor dispatch API? | Command ID / MCP / manual | Start with configurable command; partner for native hook |
| OQ-4 | Split view default for board → detail? | Tab / split | User setting; default tab |
| OQ-5 | Initiative vs project detail — one panel or two? | Shared component with variants | Shared `ProjectDetailPanel` with `type` prop |
| OQ-6 | Comment editing/deletion in MVP? | Yes / no | No; create-only MVP |
| OQ-7 | Private API key in webview CSP concerns? | Host-only mutations | **Never** expose key to webview |

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Linear API rate limits on large boards | High | Pagination, caching, debounce refresh |
| Webview bundle bloat | Medium | Code-split routes, lazy load markdown editor |
| Agent dispatch has no stable Cursor API | High | Configurable commands + document integration pattern |
| Label namespace collisions | Medium | Document convention; use `agent/` prefix |
| Dual auth (OAuth + API key) confusion | Medium | Single "Connected" status; migrate to OAuth write |
| Abodi issue count breaks flat fetch | High | Project-scoped paginated queries early |
| Optimistic UI conflicts with external edits | Medium | `updatedAt` check before mutation; refresh banner |
| Scope creep toward full Linear clone | High | Strict MVP gates per phase; non-goals list |

### Hardest unsolved: agent assignment bi-directionality

**Problem:** Local dispatch state doesn't exist in Linear; team members won't see "agent running" in Linear unless we write comments/labels/status.

**MVP stance:** Linear gets **persistent** agent assignment (label); **transient** run state stays local.

**Future:** Optional automation — on dispatch, add comment + move to In Progress; configurable per agent.

---

## Success Metrics

### Quantitative

| Metric | Baseline | Target (90 days post Phase 2) |
|---|---|---|
| Browser opens per issue click | ~100% | < 30% |
| Issues updated from IDE | 0 | ≥ 50/week (internal Abodi dogfood) |
| Median Task Detail load time | N/A | < 1s |
| Board drag-drop success rate | N/A | ≥ 99% |
| Agent assignments created | 0 | ≥ 20/week (post Phase 4) |

### Qualitative

- "I can run a standup from Cursor without opening Linear" — team survey
- Abodi Phase board usable with phase grouping without custom tooling
- Agent assignment feels native, not bolted-on

### Instrumentation (privacy-respecting, opt-in)

- Anonymous telemetry: panel opens, mutation types, error rates (if extension adds telemetry policy)

---

## Appendix A: Current codebase touchpoints

| File | Phase 1 change |
|---|---|
| `linearTreeDataProvider.ts` | Replace `vscode.open` command with `linear.openIssue` |
| `linearClient.ts` | Add `fetchIssueDetail`, mutation methods |
| `commands.ts` | Register open issue/project/board commands |
| `package.json` | Webview CSP, new commands, optional secondary view |
| `extension.ts` | Init `PanelManager`, webview bundle path |

---

## Appendix B: Assumptions log

1. Abodi project uses phase labels (`phase-1`, `phase-2`, etc.) — configurable regex.
2. User has Linear workspace admin or label-create permission for agent labels.
3. VS Code 1.96+ webview APIs sufficient (retain engine floor).
4. Personal API key has write access for mutations in MVP; OAuth write follows.
5. "Replicas" and "OpenClaw" are user-configured agents, not hard integrations.

---

*End of PRD — v0.1 draft*
