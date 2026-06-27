import { useMemo } from "react";
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
          <button type="button" className="ll-btn-secondary" onClick={loadMore}>
            Load more issues
          </button>
        </footer>
      )}
    </main>
  );
}
