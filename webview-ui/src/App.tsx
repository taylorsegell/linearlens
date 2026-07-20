import { readBootstrap } from "./bootstrap";
import { useThemeKind } from "./hooks/useThemeKind";
import { useVscodeMessaging } from "./hooks/useVscodeMessaging";
import { useProjectMessaging } from "./hooks/useProjectMessaging";
import { IssueDetailView } from "./components/IssueDetailView";
import { ProjectDetailView } from "./components/ProjectDetailView";
import { BoardApp } from "./components/board/BoardApp";
import "./styles.css";

const bootstrap = readBootstrap();

function IssueDetailApp() {
  const { issue, workflowStates, teamMembers, teamLabels, error, post } =
    useVscodeMessaging();
  if (!issue) {
    return <main className="loading">Loading issue…</main>;
  }
  return (
    <IssueDetailView
      issue={issue}
      workflowStates={workflowStates}
      teamMembers={teamMembers}
      teamLabels={teamLabels}
      error={error}
      post={post}
    />
  );
}

function ProjectDetailApp() {
  const { project, error, post } = useProjectMessaging();
  if (error && !project) {
    const projectId = bootstrap.projectId;
    return (
      <main className="loading">
        <div className="error issue-detail-error">{error}</div>
        {projectId && (
          <button
            type="button"
            className="ll-btn-secondary"
            onClick={() => post({ type: "refreshProject", projectId })}
          >
            Retry
          </button>
        )}
      </main>
    );
  }
  if (!project) {
    return <main className="loading">Loading project…</main>;
  }
  return <ProjectDetailView project={project} error={error} post={post} />;
}

export function App() {
  useThemeKind();

  if (bootstrap.panel === "board") {
    return <BoardApp />;
  }
  if (bootstrap.panel === "project") {
    return <ProjectDetailApp />;
  }
  return <IssueDetailApp />;
}
