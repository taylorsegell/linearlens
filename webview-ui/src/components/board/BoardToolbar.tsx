import { useMemo } from "react";
import { resolveHiddenStatusIds } from "../../boardColumns";
import type {
  BoardIssueCard,
  BoardMeta,
  BoardViewState,
} from "../../hooks/useBoardMessaging";
import { Chip } from "../ui/Chip";
import { SegmentedControl } from "../ui/SegmentedControl";
import { StatusColumnPicker } from "./StatusColumnPicker";

interface BoardToolbarProps {
  meta: BoardMeta;
  viewState: BoardViewState;
  workflowStates: { id: string; name: string; color: string }[];
  issues: BoardIssueCard[];
  effectiveHiddenStatusIds: string[];
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
  effectiveHiddenStatusIds,
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

  const toggleStatusHidden = (stateId: string) => {
    const collapsedStatusIds = viewState.collapsedStatusIds ?? [];
    const currentHidden = resolveHiddenStatusIds(
      workflowStates,
      issues,
      viewState.hiddenStatusIds ?? [],
      viewState.statusColumnPrefsCustomized ?? false
    );
    const isHidden = currentHidden.includes(stateId);
    onViewStateChange({
      ...viewState,
      statusColumnPrefsCustomized: true,
      hiddenStatusIds: isHidden
        ? currentHidden.filter((id) => id !== stateId)
        : [...currentHidden, stateId],
      collapsedStatusIds: isHidden
        ? collapsedStatusIds
        : collapsedStatusIds.filter((id) => id !== stateId),
    });
  };

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
          <button
            type="button"
            className="ll-btn-secondary"
            onClick={onRefresh}
            title="Refresh board"
          >
            Refresh
          </button>
          <button
            type="button"
            className="ll-btn-secondary"
            onClick={onOpenExternal}
          >
            Open in Linear
          </button>
        </div>
      </div>

      <div className="board-toolbar-row board-toolbar-row--controls">
        <SegmentedControl
          aria-label="View mode"
          value={viewState.view}
          options={[
            { value: "kanban", icon: "board", label: "Board view" },
            { value: "list", icon: "view-list", label: "List view" },
          ]}
          onChange={(view) => onViewStateChange({ ...viewState, view })}
        />

        {viewState.view === "kanban" && (
          <StatusColumnPicker
            workflowStates={workflowStates}
            hiddenStatusIds={effectiveHiddenStatusIds}
            onToggleHidden={toggleStatusHidden}
          />
        )}

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

      <div className="board-filter-section">
        <span className="filter-label">Status:</span>
        {workflowStates.map((state) => (
          <Chip
            key={state.id}
            active={viewState.filters.statusIds.includes(state.id)}
            onClick={() => toggleStatusFilter(state.id)}
          >
            {state.name}
          </Chip>
        ))}
      </div>

      {labelOptions.length > 0 && (
        <div className="board-filter-section">
          <span className="filter-label">Labels:</span>
          {labelOptions.map((label) => (
            <Chip
              key={label.id}
              active={viewState.filters.labelIds.includes(label.id)}
              onClick={() => toggleLabelFilter(label.id)}
            >
              {label.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="board-filter-section">
        <span className="filter-label">Assignee:</span>
        <Chip
          active={viewState.filters.assigneeIds.includes("__unassigned__")}
          onClick={() => toggleAssigneeFilter("__unassigned__")}
        >
          Unassigned
        </Chip>
        {assigneeOptions.map((assignee) => (
          <Chip
            key={assignee.id}
            active={viewState.filters.assigneeIds.includes(assignee.id)}
            onClick={() => toggleAssigneeFilter(assignee.id)}
          >
            {assignee.name}
          </Chip>
        ))}
      </div>

      {error && <p className="error board-toolbar-error">{error}</p>}
    </header>
  );
}
