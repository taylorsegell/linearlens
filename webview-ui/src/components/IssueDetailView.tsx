import { useEffect, useState } from "react";
import type {
  IssueDetail,
  TeamLabelOption,
  TeamMemberOption,
  WorkflowStateOption,
} from "../hooks/useVscodeMessaging";
import { IssuePropertyEditors } from "./IssuePropertyEditors";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  issue: IssueDetail;
  workflowStates: WorkflowStateOption[];
  teamMembers: TeamMemberOption[];
  teamLabels: TeamLabelOption[];
  error: string | null;
  post: (message: unknown) => void;
}

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function IssueDetailView({
  issue,
  workflowStates,
  teamMembers,
  teamLabels,
  error,
  post,
}: Props) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [comment, setComment] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);

  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setEditingDescription(false);
  }, [issue]);

  const saveTitle = () => {
    if (title.trim() && title !== issue.title) {
      post({
        type: "updateIssue",
        issueId: issue.id,
        patch: { title: title.trim() },
      });
    }
  };

  const saveDescription = () => {
    if (description !== (issue.description ?? "")) {
      post({
        type: "updateIssue",
        issueId: issue.id,
        patch: { description },
      });
    }
    setEditingDescription(false);
  };

  const openExternal = (url: string) => {
    post({ type: "openExternal", url });
  };

  const completedSubIssues = issue.subIssues.filter((sub) =>
    /done|complete|cancel/i.test(sub.state)
  ).length;

  return (
    <main className="issue-detail-app">
      <header className="issue-detail-toolbar">
        <span className="issue-detail-id">{issue.identifier}</span>
        <button
          type="button"
          className="ll-btn-secondary"
          onClick={() => openExternal(issue.url)}
        >
          Open in Linear
        </button>
      </header>

      {error && <div className="error issue-detail-error">{error}</div>}

      <div className="issue-detail-layout">
        <div className="issue-detail-main">
          <input
            className="issue-detail-title"
            value={title}
            aria-label="Issue title"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
          />

          <section className="issue-detail-section">
            <div className="issue-detail-section-header">
              <h2 className="issue-detail-section-title">Description</h2>
              {!editingDescription && (
                <button
                  type="button"
                  className="ll-btn-secondary issue-detail-section-action"
                  onClick={() => setEditingDescription(true)}
                >
                  Edit
                </button>
              )}
            </div>
            {editingDescription ? (
              <div className="issue-detail-editor">
                <textarea
                  className="issue-detail-description-input"
                  value={description}
                  rows={14}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="issue-detail-editor-actions">
                  <button
                    type="button"
                    className="ll-btn-secondary"
                    onClick={() => {
                      setDescription(issue.description ?? "");
                      setEditingDescription(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ll-btn-primary"
                    onClick={saveDescription}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <MarkdownContent
                content={issue.description}
                className="issue-detail-description"
                onOpenLink={openExternal}
              />
            )}
          </section>

          {issue.subIssues.length > 0 && (
            <section className="issue-detail-section">
              <div className="issue-detail-section-header">
                <h2 className="issue-detail-section-title">
                  Sub-issues
                  <span className="issue-detail-section-meta">
                    {completedSubIssues}/{issue.subIssues.length}
                  </span>
                </h2>
              </div>
              <ul className="issue-subissue-list">
                {issue.subIssues.map((sub) => (
                  <li key={sub.id}>
                    <button
                      type="button"
                      className="issue-subissue-row"
                      onClick={() =>
                        post({
                          type: "openIssue",
                          issueId: sub.id,
                          label: `${sub.identifier}: ${sub.title}`,
                          stateType: sub.stateType,
                          stateName: sub.state,
                        })
                      }
                    >
                      <span
                        className="issue-detail-status-dot"
                        style={{
                          backgroundColor:
                            sub.stateColor ?? "var(--ll-text-secondary)",
                        }}
                        aria-hidden
                      />
                      <span className="issue-subissue-id">{sub.identifier}</span>
                      <span className="issue-subissue-title">{sub.title}</span>
                      <span className="issue-subissue-state">{sub.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="issue-detail-section">
            <div className="issue-detail-section-header">
              <h2 className="issue-detail-section-title">Comments</h2>
            </div>
            {issue.comments.length > 0 ? (
              <ul className="issue-comment-list">
                {issue.comments.map((entry) => (
                  <li key={entry.id} className="issue-comment">
                    <div className="issue-comment-header">
                      <strong>{entry.authorName ?? "Unknown"}</strong>
                      <time>{formatRelativeTime(entry.createdAt)}</time>
                    </div>
                    <MarkdownContent
                      content={entry.body}
                      className="issue-comment-body"
                      emptyLabel=""
                      onOpenLink={openExternal}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="issue-detail-empty">No comments yet</p>
            )}
            <div className="issue-comment-compose">
              <textarea
                className="issue-comment-input"
                value={comment}
                placeholder="Leave a comment…"
                rows={4}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="issue-comment-compose-actions">
                <button
                  type="button"
                  className="ll-btn-primary"
                  disabled={!comment.trim()}
                  onClick={() => {
                    post({
                      type: "createComment",
                      issueId: issue.id,
                      body: comment,
                    });
                    setComment("");
                  }}
                >
                  Comment
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="issue-detail-sidebar">
          <IssuePropertyEditors
            issue={issue}
            workflowStates={workflowStates}
            teamMembers={teamMembers}
            teamLabels={teamLabels}
            post={post}
          />

          {(issue.project || issue.milestone) && (
            <section className="issue-detail-panel">
              <h3 className="issue-detail-panel-title">Project</h3>
              <dl className="issue-detail-properties">
                {issue.project && (
                  <div className="issue-detail-property">
                    <dt>Project</dt>
                    <dd>{issue.project.name}</dd>
                  </div>
                )}
                {issue.milestone && (
                  <div className="issue-detail-property">
                    <dt>Milestone</dt>
                    <dd>{issue.milestone.name}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
