import { extractPhaseLabel } from "../../boardLogic";
import type { BoardIssueCard } from "../../hooks/useBoardMessaging";

const PHASE_PREFIX = "phase-";

interface IssueCardProps {
  issue: BoardIssueCard;
  onOpen: () => void;
}

export function IssueCard({ issue, onOpen }: IssueCardProps) {
  const phaseLabel = extractPhaseLabel(issue.labels, PHASE_PREFIX);

  return (
    <article
      className="issue-card"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="issue-card-header">
        <span className="issue-card-id">{issue.identifier}</span>
        {issue.priority > 0 && (
          <span className="issue-card-priority">{issue.priorityLabel}</span>
        )}
      </div>
      <p className="issue-card-title">{issue.title}</p>
      <div className="issue-card-footer">
        {issue.assignee && (
          <span className="issue-card-assignee">{issue.assignee.name}</span>
        )}
        {phaseLabel && (
          <span className="issue-card-phase">{phaseLabel}</span>
        )}
      </div>
    </article>
  );
}
