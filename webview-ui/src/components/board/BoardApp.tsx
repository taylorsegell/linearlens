import { useMemo } from "react";
import {
  resolveHiddenStatusIds,
  sortWorkflowStatesForBoard,
} from "../../boardColumns";
import { applyBoardFilters } from "../../boardLogic";
import { useBoardMessaging } from "../../hooks/useBoardMessaging";
import { BoardToolbar } from "./BoardToolbar";
import { KanbanBoardView } from "./KanbanBoardView";
import { ListBoardView } from "./ListBoardView";

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

  const orderedWorkflowStates = useMemo(
    () => sortWorkflowStatesForBoard(workflowStates),
    [workflowStates]
  );

  const effectiveHiddenStatusIds = useMemo(() => {
    if (!viewState) {
      return [];
    }
    return resolveHiddenStatusIds(
      orderedWorkflowStates,
      issues,
      viewState.hiddenStatusIds ?? [],
      viewState.statusColumnPrefsCustomized ?? false
    );
  }, [issues, orderedWorkflowStates, viewState]);

  const filteredIssues = useMemo(() => {
    if (!viewState) {
      return [];
    }
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
        workflowStates={orderedWorkflowStates}
        issues={issues}
        effectiveHiddenStatusIds={effectiveHiddenStatusIds}
        error={error}
        onViewStateChange={setViewState}
        onRefresh={() => post({ type: "refreshBoard", projectId: meta.id })}
        onOpenExternal={() => post({ type: "openExternal", url: meta.url })}
      />
      {viewState.view === "kanban" ? (
        <KanbanBoardView
          issues={filteredIssues}
          workflowStates={orderedWorkflowStates}
          hiddenStatusIds={effectiveHiddenStatusIds}
          collapsedStatusIds={viewState.collapsedStatusIds ?? []}
          groupBy={viewState.groupBy}
          onMoveIssue={(issueId, stateId) =>
            post({ type: "moveIssue", issueId, stateId, projectId: meta.id })
          }
          onOpenIssue={(issue) =>
            post({
              type: "openIssue",
              issueId: issue.id,
              label: `${issue.identifier}: ${issue.title}`,
              stateType: issue.state.type,
              stateName: issue.state.name,
            })
          }
          onCollapseColumn={(stateId) => {
            const collapsedStatusIds = viewState.collapsedStatusIds ?? [];
            if (collapsedStatusIds.includes(stateId)) {
              return;
            }
            setViewState({
              ...viewState,
              collapsedStatusIds: [...collapsedStatusIds, stateId],
            });
          }}
          onExpandColumn={(stateId) => {
            setViewState({
              ...viewState,
              collapsedStatusIds: (viewState.collapsedStatusIds ?? []).filter(
                (id) => id !== stateId
              ),
            });
          }}
        />
      ) : (
        <ListBoardView
          issues={filteredIssues}
          workflowStates={orderedWorkflowStates}
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
              stateType: issue.state.type,
              stateName: issue.state.name,
            })
          }
        />
      )}
      {hasNextPage && (
        <footer className="board-footer">
          <button type="button" className="ll-btn-primary" onClick={loadMore}>
            Load more issues
          </button>
        </footer>
      )}
    </main>
  );
}
