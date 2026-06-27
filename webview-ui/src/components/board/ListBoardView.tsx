import { useMemo } from "react";
import { FixedSizeList } from "react-window";
import { sortIssuesForList } from "../../boardLogic";
import type { BoardIssueCard } from "../../hooks/useBoardMessaging";

const ROW_HEIGHT = 36;

interface ListBoardViewProps {
  issues: BoardIssueCard[];
  workflowStates: { id: string; name: string; color: string }[];
  sortBy: "priority" | "updatedAt" | "createdAt" | "identifier";
  onChangeSort: (
    sortBy: "priority" | "updatedAt" | "createdAt" | "identifier"
  ) => void;
  onChangeStatus: (issueId: string, stateId: string) => void;
  onOpenIssue: (issue: BoardIssueCard) => void;
}

export function ListBoardView({
  issues,
  workflowStates,
  sortBy,
  onChangeSort,
  onChangeStatus,
  onOpenIssue,
}: ListBoardViewProps) {
  const sorted = useMemo(
    () => sortIssuesForList(issues, sortBy),
    [issues, sortBy]
  );

  const listWidth =
    typeof window !== "undefined" ? Math.max(window.innerWidth - 32, 640) : 800;

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
            onChange={(e) =>
              onChangeSort(e.target.value as typeof sortBy)
            }
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
        width={listWidth}
        itemCount={sorted.length}
        itemSize={ROW_HEIGHT}
      >
        {({ index, style }) => {
          const issue = sorted[index];
          return (
            <div style={style} className="list-row">
              <button
                type="button"
                className="list-id"
                onClick={() => onOpenIssue(issue)}
              >
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
