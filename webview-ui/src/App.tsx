import { readBootstrap } from "./bootstrap";
import { useThemeKind } from "./hooks/useThemeKind";
import { useVscodeMessaging } from "./hooks/useVscodeMessaging";
import { IssueDetailView } from "./components/IssueDetailView";
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

export function App() {
  useThemeKind();

  if (bootstrap.panel === "board") {
    return <BoardApp />;
  }
  return <IssueDetailApp />;
}
