import { useEffect, useState } from "react";
import type { ProjectDetail } from "../hooks/useProjectMessaging";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  project: ProjectDetail;
  error: string | null;
  post: (message: unknown) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatState(state: string): string {
  if (!state) {
    return "";
  }
  return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
}

export function ProjectDetailView({ project, error, post }: Props) {
  const [description, setDescription] = useState(project.description ?? "");
  const [editingDescription, setEditingDescription] = useState(false);

  useEffect(() => {
    setDescription(project.description ?? "");
    setEditingDescription(false);
  }, [project]);

  const saveDescription = () => {
    if (description !== (project.description ?? "")) {
      post({
        type: "updateProject",
        projectId: project.id,
        patch: { description },
      });
    }
    setEditingDescription(false);
  };

  const openExternal = (url: string) => {
    post({ type: "openExternal", url });
  };

  const openBoard = () => {
    post({
      type: "openBoard",
      projectId: project.id,
      label: project.name,
    });
  };

  const metaParts = [
    formatState(project.state),
    project.lead,
    `${project.progress}%`,
  ].filter(Boolean);

  const hasDates = Boolean(project.startDate || project.targetDate);

  return (
    <main className="issue-detail-app project-detail-app">
      <header className="issue-detail-toolbar project-detail-toolbar">
        <div className="project-detail-toolbar-main">
          <h1 className="project-detail-name">{project.name}</h1>
          {metaParts.length > 0 && (
            <p className="project-detail-meta">{metaParts.join(" · ")}</p>
          )}
        </div>
        <div className="project-detail-toolbar-actions">
          <button
            type="button"
            className="ll-btn-secondary"
            onClick={openBoard}
          >
            Open board
          </button>
          <button
            type="button"
            className="ll-btn-secondary"
            onClick={() => openExternal(project.url)}
          >
            Open in Linear
          </button>
        </div>
      </header>

      {error && <div className="error issue-detail-error">{error}</div>}

      <div className="project-detail-body">
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
                aria-label="Project description"
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="issue-detail-editor-actions">
                <button
                  type="button"
                  className="ll-btn-secondary"
                  onClick={() => {
                    setDescription(project.description ?? "");
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
              content={project.description}
              className="issue-detail-description"
              onOpenLink={openExternal}
            />
          )}
        </section>

        {project.milestones.length > 0 && (
          <section className="issue-detail-section">
            <div className="issue-detail-section-header">
              <h2 className="issue-detail-section-title">Milestones</h2>
            </div>
            <ul className="project-milestone-list">
              {project.milestones.map((m) => (
                <li key={m.id} className="project-milestone-row">
                  <span className="project-milestone-name">{m.name}</span>
                  <span className="project-milestone-meta">
                    {[m.status, `${m.progress}%`].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasDates && (
          <section className="issue-detail-section">
            <div className="issue-detail-section-header">
              <h2 className="issue-detail-section-title">Key dates</h2>
            </div>
            <dl className="issue-detail-properties project-detail-dates">
              {project.startDate && (
                <div className="issue-detail-property">
                  <dt>Start</dt>
                  <dd>{formatDate(project.startDate)}</dd>
                </div>
              )}
              {project.targetDate && (
                <div className="issue-detail-property">
                  <dt>Target</dt>
                  <dd>{formatDate(project.targetDate)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section className="issue-detail-section">
          <div className="issue-detail-section-header">
            <h2 className="issue-detail-section-title">Recent issues</h2>
          </div>
          {project.recentIssues.length > 0 ? (
            <ul className="issue-subissue-list">
              {project.recentIssues.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    className="issue-subissue-row project-recent-issue-row"
                    onClick={() =>
                      post({
                        type: "openIssue",
                        issueId: issue.id,
                        label: `${issue.identifier}: ${issue.title}`,
                        stateType: issue.stateType,
                        stateName: issue.stateName ?? issue.state,
                      })
                    }
                  >
                    <span className="issue-subissue-id">{issue.identifier}</span>
                    <span className="issue-subissue-title">{issue.title}</span>
                    <span className="issue-subissue-state">
                      {issue.stateName ?? issue.state}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="issue-detail-empty">No recent issues</p>
          )}
        </section>

        <footer className="project-detail-footer">
          <button
            type="button"
            className="project-detail-footer-link"
            onClick={openBoard}
          >
            Open full board
          </button>
        </footer>
      </div>
    </main>
  );
}
