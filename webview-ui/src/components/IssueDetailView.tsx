import { useEffect, useState } from "react";
import type {
  IssueDetail,
  WorkflowStateOption,
} from "../hooks/useVscodeMessaging";

interface Props {
  issue: IssueDetail;
  workflowStates: WorkflowStateOption[];
  error: string | null;
  post: (message: unknown) => void;
}

export function IssueDetailView({ issue, workflowStates, error, post }: Props) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description ?? "");
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
  };

  return (
    <div className="issue-detail">
      <header className="issue-header">
        <span className="identifier">{issue.identifier}</span>
        <select
          value={issue.state.id}
          onChange={(e) =>
            post({
              type: "updateIssue",
              issueId: issue.id,
              patch: { stateId: e.target.value },
            })
          }
        >
          {workflowStates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={issue.priority}
          onChange={(e) =>
            post({
              type: "updateIssue",
              issueId: issue.id,
              patch: { priority: Number(e.target.value) },
            })
          }
        >
          {[0, 1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>
              P{p === 0 ? " — None" : p}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => post({ type: "openExternal", url: issue.url })}
        >
          Open in Linear
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <input
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
      />

      <div className="meta">
        {issue.project && <span>Project: {issue.project.name}</span>}
        {issue.milestone && <span>Milestone: {issue.milestone.name}</span>}
        {issue.assignee && <span>Assignee: {issue.assignee.name}</span>}
        {issue.labels.map((l) => (
          <span key={l.name} className="label">
            {l.name}
          </span>
        ))}
      </div>

      <textarea
        className="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={saveDescription}
        rows={12}
      />

      <section>
        <h3>Sub-issues</h3>
        <ul>
          {issue.subIssues.map((sub) => (
            <li key={sub.id}>
              {sub.identifier} — {sub.title} ({sub.state})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Comments</h3>
        <ul className="comments">
          {issue.comments.map((c) => (
            <li key={c.id}>
              <strong>{c.authorName ?? "Unknown"}</strong>
              <time>{new Date(c.createdAt).toLocaleString()}</time>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
        />
        <button
          type="button"
          disabled={!comment.trim()}
          onClick={() => {
            post({ type: "createComment", issueId: issue.id, body: comment });
            setComment("");
          }}
        >
          Comment
        </button>
      </section>
    </div>
  );
}
