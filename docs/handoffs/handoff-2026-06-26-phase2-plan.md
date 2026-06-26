# Handoff: Phase 2 Kanban/List — Write Implementation Plan

## Focus

Write the **Phase 2 implementation plan** (Kanban / List boards for projects) using the **writing-plans** skill. Phase 1 (Task Detail panel) is shipped and F5-verified; do **not** implement Phase 2 yet — plan only.

## Current state

### Done (Phase 1)

- **Task Detail panel** — sidebar issue click → `WebviewPanel` tab; read/write title, description, status, priority, comments; sub-issues + labels read-only.
- **Verified locally** — user ran F5 Extension Development Host; panel works end-to-end.
- **Automated verify** — `yarn typecheck && yarn test && yarn esbuild && yarn build:webview` → 38 tests pass (last run during Phase 1 execution).
- **Dev/CI** — `.vscode/launch.json` `preLaunchTask: build-all`; CI runs `build:webview` before tests.

### Not done

- **Phase 2 plan** — no file at `docs/superpowers/plans/2026-06-26-phase2-kanban-list.md` (or similar).
- **Phase 2 implementation** — Kanban/List boards, drag-drop status, project-scoped fetch, phase-label grouping.
- **Phase 3 / 4** — Project Detail, Agent Assignment (PRD only).
- **Git commit** — Phase 1 changes may be uncommitted; user did not request commit during execution.

### Assumed working (not re-tested in this handoff)

- Personal API key with **write** scope for mutations.
- `dist/webview/` built before first panel open (F5 `build-all` handles this).

## Next steps

1. **Read PRD Phase 2 section** — `docs/superpowers/specs/2026-06-26-multi-panel-linear-workspace-prd.md` → "Phase 2 — Kanban / List MVP" and "Detailed Panel Specifications §3".
2. **Read Phase 1 plan as template** — `docs/superpowers/plans/2026-06-26-phase1-task-detail-panel.md` (header format, task granularity, TDD steps, Interfaces blocks).
3. **Explore current codebase** — especially `src/panels/PanelManager.ts`, `webview-ui/`, `src/linear/linearClient.ts`, `linearTreeDataProvider.ts` — plan must extend existing patterns, not reinvent.
4. **Invoke writing-plans skill** — produce plan saved to `docs/superpowers/plans/YYYY-MM-DD-phase2-kanban-list.md`.
5. **Self-review plan** — spec coverage vs PRD Phase 2, placeholder scan, type consistency across tasks.
6. **Offer execution choice** — subagent-driven vs inline (same as Phase 1 handoff); do **not** start implementation unless user asks.

## Key context and decisions

| Decision | Rationale |
|----------|-----------|
| **Phase order** | Task Detail → Kanban → Project Detail → Agent (PRD MVP order). Phase 1 complete. |
| **Panel model** | Sidebar = nav; editor-area `WebviewPanel` tabs; shared React bundle in `webview-ui/` → `dist/webview/`. |
| **API key host-only** | Never pass secrets to webview; mutations in extension host. |
| **Linear SDK quirk** | Issue milestone field is `projectMilestone`, not `milestone`. |
| **Vite asset paths** | `getWebviewHtml.ts` regex expects `/assets/…` (Vite 6), not `./assets/`. |
| **Sidebar sync** | `onIssueUpdated` currently full `treeProvider.refresh()`; `patchCachedIssue()` exists for finer sync — Kanban plan may reuse or extend. |
| **Project click (PRD)** | Primary → Project Detail (Phase 3); Cmd+Click → Kanban. Phase 2 may open board from command/project row first; align plan with PRD navigation matrix. |
| **No commits by default** | User rules: commit only when explicitly requested. |
| **Auth constraints** | Do not rename provider id `linear` or secret keys `linear.auth` / `linear.apiKey`. |

### Phase 2 PRD scope (must cover in plan)

- Kanban + List toggle for **project-scoped** issues
- Drag-drop status change (optimistic UI)
- Filters: status, label, assignee; **group by phase label** (Abodi default)
- Virtualized scrolling for large projects
- Click card → Task Detail (reuse `PanelManager.openIssue`)
- **Skip MVP:** bulk edit, WIP limits, milestone swimlanes

## Artifacts

| Path | Role |
|------|------|
| `docs/superpowers/specs/2026-06-26-multi-panel-linear-workspace-prd.md` | Full PRD — Phase 2 requirements, IA, tech architecture |
| `docs/superpowers/plans/2026-06-26-phase1-task-detail-panel.md` | Completed Phase 1 plan — format/template reference |
| `docs/superpowers/plans/2026-06-22-linear-connect-v2-auth-modernization.md` | Older plan style reference |
| `AGENTS.md` / `CLAUDE.md` | Repo rules, verify commands, boundaries |
| `src/panels/PanelManager.ts` | Extend for `board:{projectId}` panel keys |
| `src/panels/IssueDetailPanel.ts` | Pattern for new `KanbanBoardPanel.ts` |
| `src/webview/messaging.ts` | Extend protocol with `moveIssue`, board messages |
| `src/linear/linearClient.ts` | Add project-scoped issue fetch, pagination |
| `webview-ui/` | Add Kanban/List routes or panel mode |
| `CHANGELOG.md` | `[Unreleased]` Phase 1 entry already added |

## Suggested skills

| Skill | Reason |
|-------|--------|
| **writing-plans** | Required deliverable — bite-sized TDD tasks, file paths, complete code blocks |
| **using-superpowers** | Check for applicable process skills before starting |
| **subagent-driven-development** | If user chooses option 1 after plan is written (Phase 1 pattern) |
| **executing-plans** | If user chooses inline execution after plan is written |
| **verification-before-completion** | Before claiming plan complete — self-review checklist |

## Open questions / risks

1. **Project open UX in Phase 2** — Project Detail is Phase 3; plan should specify interim navigation (e.g. command `Linear: Open Project Board`, project row click behavior until Phase 3).
2. **Pagination** — Abodi-scale 200+ issues; plan must specify project-scoped paginated queries (PRD risk).
3. **Drag-drop in webview** — HTML5 DnD vs library (e.g. `@dnd-kit`); plan should pick one and justify bundle size (<500 KB gzipped target).
4. **Phase label convention** — PRD assumes `phase-*` labels; plan should make regex/config explicit.
5. **Bundle size** — Phase 1 webview ~62 KB gzipped; Kanban virtualization + DnD must stay within PRD budget.
6. **Uncommitted Phase 1** — next agent should `git status` before planning; plan may reference files not yet on main.
