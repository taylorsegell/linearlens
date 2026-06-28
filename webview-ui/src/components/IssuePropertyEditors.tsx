import { sortWorkflowStatesForBoard } from "../boardColumns";
import type {
  IssueDetail,
  TeamLabelOption,
  TeamMemberOption,
  WorkflowStateOption,
} from "../hooks/useVscodeMessaging";
import { Chip } from "./ui/Chip";
import { PriorityIcon } from "./ui/PriorityIcon";

const PRIORITY_LABELS = ["None", "Urgent", "High", "Medium", "Low"];

interface Props {
  issue: IssueDetail;
  workflowStates: WorkflowStateOption[];
  teamMembers: TeamMemberOption[];
  teamLabels: TeamLabelOption[];
  post: (message: unknown) => void;
}

export function IssuePropertyEditors({
  issue,
  workflowStates,
  teamMembers,
  teamLabels,
  post,
}: Props) {
  const orderedStates = sortWorkflowStatesForBoard(workflowStates);
  const selectedLabelIds = new Set(issue.labels.map((l) => l.id));

  const update = (patch: Record<string, unknown>) =>
    post({ type: "updateIssue", issueId: issue.id, patch });

  return (
    <>
      <section className="issue-detail-panel">
        <h3 className="issue-detail-panel-title">Properties</h3>
        <dl className="issue-detail-properties">
          <div className="issue-detail-property issue-detail-property--editable">
            <dt>Status</dt>
            <dd>
              <label className="issue-detail-property-control">
                <span
                  className="issue-detail-status-dot"
                  style={{ backgroundColor: issue.state.color }}
                  aria-hidden
                />
                <select
                  className="issue-detail-property-select"
                  value={issue.state.id}
                  aria-label="Status"
                  onChange={(e) => update({ stateId: e.target.value })}
                >
                  {orderedStates.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>
            </dd>
          </div>
          <div className="issue-detail-property issue-detail-property--editable">
            <dt>Priority</dt>
            <dd>
              <label className="issue-detail-property-control">
                <PriorityIcon priority={issue.priority} />
                <select
                  className="issue-detail-property-select"
                  value={issue.priority}
                  aria-label="Priority"
                  onChange={(e) =>
                    update({ priority: Number(e.target.value) })
                  }
                >
                  {[0, 1, 2, 3, 4].map((p) => (
                    <option key={p} value={p}>
                      {p === 0 ? "No priority" : PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
            </dd>
          </div>
          <div className="issue-detail-property issue-detail-property--editable">
            <dt>Assignee</dt>
            <dd>
              <select
                className="issue-detail-property-select issue-detail-property-select--full"
                value={issue.assignee?.id ?? ""}
                aria-label="Assignee"
                onChange={(e) =>
                  update({
                    assigneeId: e.target.value ? e.target.value : null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        </dl>
      </section>

      <section className="issue-detail-panel">
        <h3 className="issue-detail-panel-title">Labels</h3>
        <div className="issue-detail-label-picker">
          {teamLabels.length === 0 ? (
            <p className="issue-detail-empty">No labels on this team</p>
          ) : (
            teamLabels.map((label) => {
              const active = selectedLabelIds.has(label.id);
              return (
                <Chip
                  key={label.id}
                  active={active}
                  aria-pressed={active}
                  style={
                    label.color
                      ? {
                          borderColor: `${label.color}55`,
                          backgroundColor: active
                            ? `${label.color}33`
                            : undefined,
                        }
                      : undefined
                  }
                  onClick={() => {
                    const next = active
                      ? issue.labels
                          .filter((l) => l.id !== label.id)
                          .map((l) => l.id)
                      : [...issue.labels.map((l) => l.id), label.id];
                    update({ labelIds: next });
                  }}
                >
                  {label.name}
                </Chip>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
