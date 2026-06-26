# Handoff: Phase 2 Kanban/List — Execute Implementation Plan

## Focus

Execute the **Phase 2 Kanban/List board** implementation using the plan at `docs/superpowers/plans/2026-06-26-phase2-kanban-list.md`. Planning is complete; implementation has not started.

## Current state

### Done

- **Phase 2 plan written** — `docs/superpowers/plans/2026-06-26-phase2-kanban-list.md` (14 TDD tasks, self-reviewed against PRD Phase 2).
- **Phase 1 shipped (codebase)** — Task Detail panel, webview build pipeline, `PanelManager`, messaging protocol, LinearService issue detail fetch/mutations. F5-verified per prior handoff.
- **Prior handoff** — `docs/handoffs/handoff-2026-06-26-phase2-plan.md` (planning session context).

### Not done

- **Phase 2 implementation** — no `KanbanBoardPanel`, board types, `@dnd-kit`, `react-window`, or board UI yet.
- **Execution choice** — user was offered subagent-driven vs inline execution; no choice recorded yet.
- **Phase 3 / 4** — Project Detail, Agent Assignment (PRD only).

### Verified vs assumed

| Item | Status |
|------|--------|
| Phase 2 plan file exists | Verified |
| Phase 1 code in workspace | Verified (files present) |
| `yarn typecheck && yarn test && yarn build` | Assumed passing (38 tests per prior handoff; not re-run this session) |
| Git repo / commits | Not a git repository in workspace (or `.git` unavailable) |

## Next steps

1. **Read the plan** — `docs/superpowers/plans/2026-06-26-phase2-kanban-list.md` from Task 1 onward.
2. **Confirm execution mode** — subagent-driven (recommended) or inline with executing-plans skill; default to subagent-driven if user does not specify.
3. **Run baseline verify** — `yarn typecheck && yarn test && yarn esbuild && yarn build:webview` before Task 1.
4. **Execute Task 1** — board types + extend messaging protocol (TDD steps in plan).
5. **Continue tasks 2–14 sequentially** — commit only if user explicitly requests.
6. **Finish with Task 14** — CHANGELOG, bundle size check, F5 manual checklist, full verify.

## Key context and decisions

| Decision | Rationale |
|----------|-----------|
| **Plan-only last session** | User explicitly requested plan, not implementation. |
| **14 tasks, TDD** | Matches Phase 1 plan style; each task ends with verify + optional commit. |
| **Unified paginated fetch** | 50/page project-scoped; client-side column assignment; not per-column API pagination. |
| **@dnd-kit + react-window** | DnD ~30 KB + virtualization ~6 KB gzipped; stay under 500 KB bundle budget. |
| **Interim project nav** | Primary project click → board; context menu → browser; QuickPick command. Phase 3 will add Project Detail as primary. |
| **Phase swimlanes** | Default `groupBy: "phaseLabel"`; prefix configurable via `linear.board.phaseLabelPrefix` (`phase-`). |
| **Webview bootstrap** | `window.__LINEAR_PANEL__` injected in generalized `getWebviewHtml` (Task 6). |
| **Duplicate boardLogic in webview** | Copy pure filter/group fns to `webview-ui/src/boardLogic.ts` — avoid bundling extension host code. |
| **Auth constraints** | Do not rename provider id `linear` or secrets `linear.auth` / `linear.apiKey`. |
| **SDK quirk** | Issue milestone field is `projectMilestone`, not `milestone`. |
| **No commits by default** | User rules: commit only when explicitly requested. |

## Artifacts

| Path | Role |
|------|------|
| `docs/superpowers/plans/2026-06-26-phase2-kanban-list.md` | **Primary execution plan** — 14 tasks |
| `docs/superpowers/plans/2026-06-26-phase1-task-detail-panel.md` | Completed Phase 1 plan (pattern reference) |
| `docs/superpowers/specs/2026-06-26-multi-panel-linear-workspace-prd.md` | PRD — Phase 2 scope §3, phasing §Phase 2 |
| `docs/handoffs/handoff-2026-06-26-phase2-plan.md` | Prior handoff (planning session) |
| `src/panels/PanelManager.ts` | Extend with `openBoard` (Task 8) |
| `src/webview/messaging.ts` | Extend with board messages (Task 1) |
| `src/linear/linearClient.ts` | Add board fetch (Task 5) |
| `webview-ui/` | Board UI, routing (Tasks 9–12) |
| `AGENTS.md` / `CLAUDE.md` | Verify commands, boundaries |

## Suggested skills

| Skill | Reason |
|-------|--------|
| **executing-plans** or **subagent-driven-development** | Required for task-by-task plan execution |
| **test-driven-development** | Plan specifies failing test first per task |
| **verification-before-completion** | Run full verify before claiming Phase 2 done |
| **systematic-debugging** | If F5 or DnD/webview issues arise during implementation |

## Open questions / risks

1. **Execution mode unset** — ask user or default subagent-driven per plan handoff.
2. **No git repo detected** — commits/branch workflow may be unavailable; confirm with user.
3. **Bundle size** — `@dnd-kit` + `react-window` added in Task 9; Task 14 requires gzip check < 500 KB.
4. **@dnd-kit droppable wiring** — Task 11 skeleton shows structure; implementer must add `useDroppable` / `useDraggable` fully.
5. **LinearTreeItem url override** — project items pass `url` to constructor which sets `vscode.open`; plan overrides `item.command` after — verify this works (issues pattern already does).
6. **Phase 3 navigation change** — when Project Detail ships, revert primary project click from board to detail panel.
