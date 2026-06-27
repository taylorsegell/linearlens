import { useMemo } from "react";
import type {
  BoardIssueCard,
  BoardMeta,
  BoardViewState,
} from "../../hooks/useBoardMessaging";

interface BoardToolbarProps {
  meta: BoardMeta;
  viewState: BoardViewState;
  workflowStates: { id: string; name: string; color: string }[];
  issues: BoardIssueCard[];
  error: string | null;
  onViewStateChange: (next: BoardViewState) => void;
  onRefresh: () => void;
  onOpenExternal: () => void;
}

export function BoardToolbar({
  meta,
  viewState,
  workflowStates,
  issues,
  error,
  onViewStateChange,
  onRefresh,
  onOpenExternal,
}: BoardToolbarProps) {
  const labelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      for (const label of issue.labels) {
        map.set(label.id, label.name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [issues]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      if (issue.assignee) {
        map.set(issue.assignee.id, issue.assignee.name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [issues]);

  const toggleStatusFilter = (stateId: string) => {
    const statusIds = viewState.filters.statusIds.includes(stateId)
      ? viewState.filters.statusIds.filter((id) => id !== stateId)
      : [...viewState.filters.statusIds, stateId];
    onViewStateChange({
      ...viewState,
      filters: { ...viewState.filters, statusIds },
    });
  };

  const toggleLabelFilter = (labelId: string) => {
    const labelIds = viewState.filters.labelIds.includes(labelId)
      ? viewState.filters.labelIds.filter((id) => id !== labelId)
      : [...viewState.filters.labelIds, labelId];
    onViewStateChange({
      ...viewState,
      filters: { ...viewState.filters, labelIds },
    });
  };

  const toggleAssigneeFilter = (assigneeId: string | "__unassigned__") => {
    const assigneeIds = viewState.filters.assigneeIds.includes(assigneeId)
      ? viewState.filters.assigneeIds.filter((id) => id !== assigneeId)
      : [...viewState.filters.assigneeIds, assigneeId];
    onViewStateChange({
      ...viewState,
      filters: { ...viewState.filters, assigneeIds },
    });
  };

  return (
    <header className="board-toolbar">
      <div className="board-toolbar-row">
        <h1 className="board-title">
          {meta.name}
          <span className="board-progress">{meta.progress}%</span>
        </h1>
        <div className="board-toolbar-actions">
          <button type="button" onClick={onRefresh} title="Refresh board">
            Refresh
          </button>
          <button type="button" onClick={onOpenExternal}>
            Open in Linear
          </button>
        </div>
      </div>

      <div className="board-toolbar-row">
        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={viewState.view === "kanban" ? "active" : ""}
            onClick={() => onViewStateChange({ ...viewState, view: "kanban" })}
          >
            Kanban
          </button>
          <button
            type="button"
            className={viewState.view === "list" ? "active" : ""}
            onClick={() => onViewStateChange({ ...viewState, view: "list" })}
          >
            List
          </button>
        </div>

        <label className="toolbar-field">
          Group by
          <select
            value={viewState.groupBy}
            onChange={(e) =>
              onViewStateChange({
                ...viewState,
                groupBy: e.target.value as BoardViewState["groupBy"],
              })
            }
          >
            <option value="phaseLabel">Phase label</option>
            <option value="assignee">Assignee</option>
            <option value="none">None</option>
          </select>
        </label>

        <label className="toolbar-field toolbar-search">
          Search
          <input
            type="search"
            value={viewState.filters.search}
            placeholder="ID or title…"
            onChange={(e) =>
              onViewStateChange({
                ...viewState,
                filters: { ...viewState.filters, search: e.target.value },
              })
            }
          />
        </label>
      </div>

      <div className="board-filter-chips">
        <span className="filter-label">Status:</span>
        {workflowStates.map((state) => (
          <button
            key={state.id}
            type="button"
            className={
              viewState.filters.statusIds.includes(state.id)
                ? "filter-chip active"
                : "filter-chip"
            }
            onClick={() => toggleStatusFilter(state.id)}
          >
            {state.name}
          </button>
        ))}

        {labelOptions.length > 0 && (
          <>
            <span className="filter-label">Labels:</span>
            {labelOptions.map((label) => (
              <button
                key={label.id}
                type="button"
                className={
                  viewState.filters.labelIds.includes(label.id)
                    ? "filter-chip active"
                    : "filter-chip"
                }
                onClick={() => toggleLabelFilter(label.id)}
              >
                {label.name}
              </button>
            ))}
          </>
        )}

        <span className="filter-label">Assignee:</span>
        <button
          type="button"
          className={
            viewState.filters.assigneeIds.includes("__unassigned__")
              ? "filter-chip active"
              : "filter-chip"
          }
          onClick={() => toggleAssigneeFilter("__unassigned__")}
        >
          Unassigned
        </button>
        {assigneeOptions.map((assignee) => (
          <button
            key={assignee.id}
            type="button"
            className={
              viewState.filters.assigneeIds.includes(assignee.id)
                ? "filter-chip active"
                : "filter-chip"
            }
            onClick={() => toggleAssigneeFilter(assignee.id)}
          >
            {assignee.name}
          </button>
        ))}
      </div>

      {error && <p className="error board-toolbar-error">{error}</p>}
    </header>
  );
}
