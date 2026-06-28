import { useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList } from "react-window";
import { sortIssuesForList } from "../../boardLogic";
import type { BoardIssueCard } from "../../hooks/useBoardMessaging";

const ROW_HEIGHT = 44;

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

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      const next = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
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
  const { ref, width, height } = useElementSize<HTMLDivElement>();

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
      <div ref={ref} className="list-board-body">
        {width > 0 && height > 0 && (
          <FixedSizeList
            height={height}
            width={width}
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
                    className="list-status-select"
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
        )}
      </div>
    </div>
  );
}
